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
  uint56 public constant HIGH_NUMBER = 15; // THIS IS THE MAX NUMBER THAT CAN BE PREDICTED (0-15)
  uint256 public constant FUTURE_BLOCKS = 2; // THIS IS THE NUMBER OF BLOCKS IN THE FUTURE THAT THE USER has to wait to check the result

  event Prediction(address indexed player, uint256 indexed blockNumber, uint8 number);

  event CheckIfMatch(address indexed player, uint256 indexed blockNumber, uint8 number);

  constructor() payable {}

  function predict(uint8 _number) public {
    require(_number < HIGH_NUMBER, "Number must be smaller than HIGH_NUMBER");
    PredictStruct storage userPredict = predictions[msg.sender];
    require(userPredict.blockNumber < block.number - FUTURE_BLOCKS, "Already played");

    userPredict.blockNumber = block.number;
    userPredict.number = _number;
    userPredict.rolled = false;

    emit Prediction(msg.sender, block.number, _number);
  }

  // rlPBytes is the RLP encoded block header
  function checkIfMatchToPredict(bytes memory rlpBytes) public returns (string memory result) {
    PredictStruct storage userPredict = predictions[msg.sender];

    require(userPredict.blockNumber > 0, "No played");
    require(!userPredict.rolled, "Already rolled");
    require(block.number >= userPredict.blockNumber + FUTURE_BLOCKS, "Future block not reached"); // the user has to wait FUTURE_BLOCKS blocks to check the result
    require(block.number < userPredict.blockNumber + FUTURE_BLOCKS + 256, "You miss the roll window"); // the user has to check the result within 256 blocks

    RLPReader.RLPItem[] memory ls = rlpBytes.toRlpItem().toList(); // parse the RLP encoded block header

    // uint256 difficulty = ls[7].toUint();
    // we have to use mixHash on PoS networks -> https://eips.ethereum.org/EIPS/eip-4399
    bytes memory difficulty = ls[13].toBytes(); // get the difficulty from the block header

    uint256 blockNumber = ls[8].toUint();

    require(blockNumber == userPredict.blockNumber + FUTURE_BLOCKS, "Wrong block"); // check if the block number is the expected one

    require(blockhash(blockNumber) == keccak256(rlpBytes), "Wrong block header"); // check if the block hash is the expected one

    bytes32 hash = keccak256(abi.encodePacked(difficulty, address(this), msg.sender)); // generate a random number based on the difficulty, the contract address and the user address
    // the random number is between 0 and 15 (HIGH_NUMBER)
    uint8 roll = uint8(uint256(hash) % (HIGH_NUMBER + 1)); // since the random number is between 0 and 15. We have to add 1 to the modulo so the result is between 0 and 15

    userPredict.rolled = true; 
    userPredict.rolledNumber = roll; // store the random number generated

    emit CheckIfMatch(msg.sender, userPredict.blockNumber, roll);

    if (roll == userPredict.number) {
      return "Congratulations, you won!"; // perform any operation if the user wins i.e. transfer some tokens
    } else {
      return "Sorry, you lost"; // perform any operation if the user loses
    }
  }

  receive() external payable {}
}
