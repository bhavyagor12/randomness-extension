"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { createPublicClient, http, keccak256, toRlp, toHex } from "viem";
import { useAccount } from "wagmi";
import { useBlockNumber } from "wagmi";
import { useWalletClient } from "wagmi";
import { IntegerInput } from "~~/components/scaffold-eth";
import {
  useScaffoldContract,
  useScaffoldReadContract,
  useScaffoldWriteContract,
  useTransactor,
} from "~~/hooks/scaffold-eth";
import scaffoldConfig from "~~/scaffold.config";
import { notification } from "~~/utils/scaffold-eth";

const RandomNess: NextPage = () => {
  const [number, setNumber] = useState<string | bigint>("");
  const [predictNumber, setPredictNumber] = useState<number>();
  const [targetBlockNumber, setTargetBlockNumber] = useState<bigint>();
  const [rollDisabled, setRollDisabled] = useState<boolean>(true);
  const [showRollNotice, setShowRollNotice] = useState<boolean>(false);
  const [missedWindow, setMissedWindow] = useState<boolean>(false);
  const [rolled, setRolled] = useState<boolean>(false);
  const [betted, setBetted] = useState<boolean>(false);
  const [rolling, setRolling] = useState<boolean>(false);

  const writeTx = useTransactor();
  const { address } = useAccount();
  const { data: blockNumber } = useBlockNumber();

  const publicClient = createPublicClient({
    chain: scaffoldConfig.targetNetworks[0],
    transport: http(),
  });
  const { writeContractAsync: writeAsync, isPending, isMining } = useScaffoldWriteContract("RandomnessPrediction");

  const { data: walletClient } = useWalletClient();

  const { data: diceGameContract } = useScaffoldContract({
    contractName: "RandomnessPrediction",
    walletClient,
  });

  const { data: futureBlocks } = useScaffoldReadContract({
    contractName: "RandomnessPrediction",
    functionName: "FUTURE_BLOCKS",
  });

  const { data: predicitons } = useScaffoldReadContract({
    contractName: "RandomnessPrediction",
    functionName: "predictions",
    args: [address],
  });

  useEffect(() => {
    if (predicitons && futureBlocks) {
      setTargetBlockNumber(predicitons[1] + (futureBlocks as unknown as bigint));
    }
  }, [predicitons, futureBlocks]);

  useEffect(() => {
    if (predicitons !== undefined && predicitons[2]) {
      setRolled(true);
    } else {
      setRolled(false);
    }
    if (predicitons !== undefined && predicitons[1] > 0) {
      setBetted(true);
    } else {
      setBetted(false);
    }
  }, [predicitons]);

  useEffect(() => {
    if (blockNumber && targetBlockNumber) {
      const show = blockNumber < targetBlockNumber;
      setShowRollNotice(show);
      const missed = blockNumber > targetBlockNumber + 256n && predicitons !== undefined && !predicitons[2];
      setMissedWindow(missed);
      const disabled = show || missed || (predicitons !== undefined && predicitons[2]);
      setRollDisabled(disabled);
    } else {
      setShowRollNotice(false);
      setMissedWindow(false);
      setRollDisabled(true);
    }
  }, [blockNumber, targetBlockNumber, predicitons]);

  const betDisabled = isPending || isMining || (betted && !missedWindow && !rolled);

  const predict = async () => {
    console.log("Starting block at time of predict", blockNumber);
    console.log("targetBlockNumber: ", targetBlockNumber);

    const blockData = await publicClient.getBlock({ blockNumber: targetBlockNumber }); // gets block data

    console.log("blockData: ", blockData);

    const values: `0x${string}`[] = []; // array of values to be hashed
    values.push(blockData.parentHash);
    values.push(blockData.sha3Uncles);
    values.push(blockData.miner as `0x${string}`);
    values.push(blockData.stateRoot);
    values.push(blockData.transactionsRoot);
    values.push(blockData.receiptsRoot);
    values.push(blockData.logsBloom);
    values.push(`0x${blockData.difficulty.toString(16)}`);
    values.push(`0x${blockData.number.toString(16)}`);
    values.push(`0x${blockData.gasLimit.toString(16)}`);
    values.push(`0x${blockData.gasUsed.toString(16)}`);
    values.push(`0x${blockData.timestamp.toString(16)}`);
    values.push(blockData.extraData);
    values.push(blockData.mixHash);
    values.push(blockData.nonce);
    if ("baseFeePerGas" in blockData && blockData.baseFeePerGas !== null) {
      values.push(`0x${blockData.baseFeePerGas.toString(16)}`);
    }
    if ("withdrawalsRoot" in blockData && blockData.withdrawalsRoot !== undefined) {
      values.push(blockData.withdrawalsRoot);
    }
    if ("blobGasUsed" in blockData && blockData.blobGasUsed !== undefined && blockData.blobGasUsed !== null) {
      values.push(toHex(blockData.blobGasUsed));
    }
    if ("excessBlobGas" in blockData && blockData.excessBlobGas !== undefined && blockData.excessBlobGas !== null) {
      values.push(toHex(blockData.excessBlobGas));
    }
    if (
      "parentBeaconBlockRoot" in blockData &&
      blockData.parentBeaconBlockRoot !== undefined &&
      blockData.parentBeaconBlockRoot !== null
    ) {
      values.push(blockData.parentBeaconBlockRoot as `0x${string}`);
    }
    console.log("blockData values: ", values);
    for (let i = 0; i < values.length; i++) {
      if (values[i] === "0x0") {
        values[i] = "0x";
      }
      if (values[i].length % 2 === 1) {
        values[i] = ("0x0" + values[i].substring(2)) as `0x${string}`;
      }
    }
    console.log("blockData values after: ", values);

    const rlpEncodedValues = toRlp(values);
    console.log("blockData RLP: ", rlpEncodedValues);

    const blockHash = keccak256(rlpEncodedValues);
    console.log("blockData hash: ", blockHash);
    console.log(blockData.hash.length, blockHash.length);
    if (blockHash !== blockData.hash) {
      notification.error("Block hash mismatch");
      return;
    }
    setRolling(true);
    setRollDisabled(true);

    if (diceGameContract !== undefined) {
      const makeWrite = () => diceGameContract.write.checkIfMatchToPredict([rlpEncodedValues]);

      await writeTx(makeWrite, {
        onBlockConfirmation: txnReceipt => {
          console.log("Transaction blockHash", txnReceipt.blockHash);
          setRolled(true);
          setRollDisabled(true);
        },
      });
      setRolling(false);
    }
  };

  return (
    <>
      <div className="flex items-center flex-col flex-grow pt-10">
        <div className="px-5">
          <h1 className="text-center mb-8">
            <span className="block text-4xl font-bold">Introduction to Randomness</span>
            <span className="block text-4xl font-bold">Bet a number from 0 to 15</span>
            <span className="block text-2xl mb-2 mt-2">Click Predict and see if its a match</span>
          </h1>
          <div className="text-center text-lg">
            <>
              <IntegerInput
                value={number}
                onChange={newNumber => {
                  setNumber(newNumber);
                  setPredictNumber(Number(newNumber));
                }}
                disabled={betDisabled}
                placeholder="number"
                disableMultiplyBy1e18
              />

              <button
                className="btn btn-primary mt-2"
                onClick={async () => {
                  if (
                    predictNumber !== undefined &&
                    predictNumber !== null &&
                    predictNumber >= 0 &&
                    predictNumber <= 15
                  ) {
                    await writeAsync(
                      {
                        functionName: "predict",
                        args: [predictNumber],
                      },
                      {
                        onBlockConfirmation: (txnReceipt: any) => {
                          console.log("Transaction blockHash", txnReceipt.blockHash);
                          setBetted(true);
                        },
                      },
                    );
                  } else {
                    notification.error("Invalid number (0 to 15)");
                  }
                }}
                disabled={betDisabled}
              >
                Predict on {predictNumber}
              </button>
            </>
            {predicitons && predicitons[1] !== 0n && (
              <>
                <p className="text-xl font-bold">Your bet: {predicitons[0].toString()}</p>
                {rolled && !rolling && <p className="text-xl font-bold">Rolled: {predicitons[3].toString()}</p>}
                {rolling && <p className="text-xl font-bold">Rolling...</p>}
                {showRollNotice && targetBlockNumber && blockNumber && (
                  <p>Wait for {(targetBlockNumber - blockNumber).toString()} blocks to roll the dice</p>
                )}
                {missedWindow && <p className="text-l font-bold">You missed the window to roll the dice</p>}
                <button className="btn btn-primary" disabled={rollDisabled} onClick={predict}>
                  Predict
                </button>
              </>
            )}
          </div>
          <div className="border-2 border-secondary mt-4">
            <p className="text-start text-lg">
              1) Get started by looking at:{" "}
              <Link href="https://eips.ethereum.org/EIPS/eip-4399" className="underline">
                Block Difficulty EIP-4399
              </Link>{" "}
            </p>
            <p className="text-start text-lg">
              2) Navigate to the contract:{""}
              <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
                contracts/RandomnessPrediction.sol
              </code>
            </p>
            <p className="text-start text-lg">
              3) Check the contract and its comments to understand how the randomness is generated
            </p>
            <p className="text-start text-lg">
              4) Deploy the contract using the{" "}
              <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
                yarn deploy
              </code>{" "}
            </p>
            <p className="text-start text-lg">
              5) On the frontend checkout the{" "}
              <code className="italic bg-base-300 text-base font-bold max-w-full break-words break-all inline-block">
                packages/nextjs/app/randomness/page.tsx
              </code>{" "}
            </p>
            <p className="text-start text-lg">
              6) Here navigate to the predict function and understand how the block data is used to generate randomness
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default RandomNess;
