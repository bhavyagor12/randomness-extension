# Randomness extension: -- context from : `https://app.buidlguidl.com/build/NpGDQHQ1140K9QaG5kth`

![alt text](./randomness.png)

This Scaffold-ETH 2 extension comes pre-configured with RANDOMNESS generator contract and frontend to interact with it 

## Installation

1. Create a new project with the radomness extension:

```bash
npx create-eth@latest -e bhavyagor12/randomness-extension
```

2. Deploy the contracts by altering the deploy contract file

## Documentation
Ethereum PoS introduces randomness using block.difficulty. Look at https://eips.ethereum.org/EIPS/eip-4399 for more information.

Files to checkout `packages/nextjs/app/randomness/page.tsx`  and `packages/hardhat/contracts/RandomnessPrediction.sol`
This contract can be extended to do bets etc etc

GO SHIP!!!
