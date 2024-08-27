//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./RLPReader.sol";

contract RandomnessPrediction {
	using RLPReader for RLPReader.RLPItem;
	using RLPReader for bytes;

	struct PredictStruct {
		uint8 number;
		uint256 blockNumber;
		bool rolled;
		uint8 rolledNumber;
	}

	mapping(address => PredictStruct) public predictions;
  uint56 public constant HIGH_NUMBER = 15;
	uint256 public constant FUTURE_BLOCKS = 2;

	event Prediction(
		address indexed player,
		uint256 indexed blockNumber,
		uint8 number
	);

	event CheckIfMatch(
		address indexed player,
		uint256 indexed blockNumber,
		uint8 number
	);

	constructor() payable {}

	function predict(uint8 _number) public {
		require(_number < HIGH_NUMBER, "Number must be smaller than HIGH_NUMBER");
		PredictStruct storage userPredict = predictions[msg.sender];
		require(
			userPredict.blockNumber < block.number - FUTURE_BLOCKS,
			"Already played"
		);

		userPredict.blockNumber = block.number;
		userPredict.number = _number;
		userPredict.rolled = false;

		emit Prediction(msg.sender, block.number, _number);
	}

	function checkIfMatchToPredict(
		bytes memory rlpBytes
	) public returns (string memory result) {
		PredictStruct storage userPredict = predictions[msg.sender];

		require(userPredict.blockNumber > 0, "No played");
		require(!userPredict.rolled, "Already rolled");
		require(
			block.number >= userPredict.blockNumber + FUTURE_BLOCKS,
			"Future block not reached"
		);
		require(
			block.number < userPredict.blockNumber + FUTURE_BLOCKS + 256,
			"You miss the roll window"
		);

		RLPReader.RLPItem[] memory ls = rlpBytes.toRlpItem().toList();

		// uint256 difficulty = ls[7].toUint();
		// we have to use mixHash on PoS networks -> https://eips.ethereum.org/EIPS/eip-4399
		bytes memory difficulty = ls[13].toBytes();

		uint256 blockNumber = ls[8].toUint();

		require(
			blockNumber == userPredict.blockNumber + FUTURE_BLOCKS,
			"Wrong block"
		);

		require(
			blockhash(blockNumber) == keccak256(rlpBytes),
			"Wrong block header"
		);

		bytes32 hash = keccak256(
			abi.encodePacked(difficulty, address(this), msg.sender)
		);
		uint8 roll = uint8(uint256(hash) % 16);

		userPredict.rolled = true;
		userPredict.rolledNumber = roll;

		emit CheckIfMatch(msg.sender, userPredict.blockNumber, roll);

		if (roll == userPredict.number) {
			return "Congratulations, you won!";
		} else {
			return "Sorry, you lost";
		}
	}
  
	receive() external payable {}
}
