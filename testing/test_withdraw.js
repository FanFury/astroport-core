import {
    mintInitMessage,
    MintingContractPath,
    PairContractPath,
    walletTest1,
    walletTest2,
    walletTest3,
    liquidity_reward_wallet,
    bonded_reward_wallet,
    treasury_wallet,
    mint_wallet,
    // treasury_wallet,
    liquidity_wallet,
    marketing_wallet,
    terraClient,
    StakingContractPath,
    FactoryContractPath,
    ProxyContractPath
} from './constants.js';
import {
    storeCode,
    queryContract,
    executeContract,
    instantiateContract,
    sendTransaction,
    readArtifact,
    writeArtifact
} from "./utils.js";

import { primeAccountsWithFunds } from "./primeCustomAccounts.js";

import { promisify } from 'util';

import * as readline from 'node:readline';

import * as chai from 'chai';
import { Coin } from '@terra-money/terra.js';
const assert = chai.assert;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = promisify(rl.question).bind(rl);

const main = async () => {
    let deploymentDetails = readArtifact(terraClient.chainID);
    console.log("deploymentDetails = " + JSON.stringify(deploymentDetails, null, ' '));
    try {
        testOperations(deploymentDetails).then(() => {
            console.log("Finished");
        });
    } catch (error) {
        console.log(error);
    }
    rl.close();

}

const testOperations = async (deploymentDetails) => {
    withdrawLiquidity(deploymentDetails).then(() => {
        console.log("Finished pipe!");
    });
}

const withdrawLiquidity = async (deploymentDetails) => {

    console.log(`Starting withdraw test`);
    console.log(`Pool Contract ${deploymentDetails.poolPairContractAddress}, Proxy Contract ${deploymentDetails.proxyContractAddress} `);

    let useContract = deploymentDetails.poolPairContractAddress;
    console.log(`Using Contract ${useContract} `);

    let useWallet = treasury_wallet;
    console.log(`Using Wallet ${useWallet.key.accAddress} `);

    let qResp = await queryContract(deploymentDetails.furyContractAddress, {
        balance: { address : useWallet.key.accAddress }
    });
    console.log(`fury balance in wallet = ${qResp.balance}`);
    qResp = await queryContract(deploymentDetails.poolLpTokenAddress, {
        balance: { address : useWallet.key.accAddress }
    });
    console.log(`lptoken balance in_wallet = ${qResp.balance}`);

    qResp = await queryContract(deploymentDetails.proxyContractAddress, {
        pool: {}
    });
    //let furyAmount = Math.ceil(Number(qResp.assets[0].amount) / 100);
    //let ustAmount = Math.ceil(Number(qResp.assets[1].amount) / 100);
    let furyAmount = Math.ceil(Number(qResp.assets[0].amount));
    let ustAmount = Math.ceil(Number(qResp.assets[1].amount));
    console.log(`query pool response = ${JSON.stringify(qResp)}`);
    console.log(`uusd ${ustAmount}, fury ${furyAmount.toString()}, fury_price_in_ust ${ustAmount/furyAmount}`);

    // let decreaseAllowanceMsg = {
    //     decrease_allowance: {
    //         spender: useContract,
    //         amount: "154997301"
    //     }
    // };
    // let decrAllowResp = await executeContract(useWallet, deploymentDetails.furyContractAddress, decreaseAllowanceMsg);
    // console.log(`Decrease allowance at useContract for useWallet response hash = ${decrAllowResp['txhash']}`);

    qResp = await queryContract(deploymentDetails.furyContractAddress, {
        all_allowances: {
            owner : useWallet.key.accAddress,
        }
    });
    console.log(`query allowance wallet response = ${JSON.stringify(qResp)}`);
    qResp = await queryContract(deploymentDetails.furyContractAddress, {
        all_allowances: {
            owner : deploymentDetails.proxyContractAddress,
        }
    });
    console.log(`query allowance proxy response = ${JSON.stringify(qResp)}`);

    
   furyAmount = Math.ceil(furyAmount/10000)
   ustAmount = Math.ceil(ustAmount/10000)
   let ustTax = Math.ceil(ustAmount/1000)
   let increaseAllowanceMsg = {
        increase_allowance: {
            spender: useContract,
            amount: furyAmount.toString()
        }
    };
    let incrAllowResp = await executeContract(useWallet, deploymentDetails.furyContractAddress, increaseAllowanceMsg);
    console.log(`Increase allowance - fury - ${furyAmount} response hash = ${incrAllowResp['txhash']}`);
    let executeMsg = {
        provide_liquidity: {
            assets: [
                {
                    info: {
                        native_token: {
                            denom: "uusd"
                        }
                    },
                    amount: ustAmount.toString()
                },
                {
                    info: {
                        token: {
                            contract_addr: deploymentDetails.furyContractAddress
                        }
                    },
                    amount: furyAmount.toString()
                }
            ],
            receiver: useWallet.key.accAddress,
            // slippage_tolerance:"0.1",
        }
    };
    if (useContract != deploymentDetails.poolPairContractAddress) {
        console.log(`uust - ${ustAmount} + tax uusd ${ustTax}`);
        qResp = await executeContract(treasury_wallet, useContract, executeMsg, { 'uusd': ustAmount+ustTax });
    } else {
        qResp = await executeContract(treasury_wallet, useContract, executeMsg, { 'uusd': ustAmount });
    }
    let lptokens = qResp.logs[0].eventsByType.wasm.share[0]
    console.log(`lptokens - ${lptokens}`);
    console.log(`Save provide_liquidity Response - ${qResp['txhash']}`);
    //  let contractAddress = result.logs[0].events[0].attributes.filter(element => element.key == 'contract_address').map(x => x.value);
    //  deploymentDetails.poolPairContractAddress = response.logs[0].eventsByType.from_contract.pair_contract_addr[0]

    let withdrawMsg = {
        withdraw_liquidity : {
            sender: useWallet.key.accAddress,
            amount: lptokens.toString()
        }
    };
    let base64Msg = Buffer.from(JSON.stringify(withdrawMsg)).toString('base64');
    executeMsg = {
        send: {
            contract: useContract,
            amount: "50000",
            msg: base64Msg,
        }
    };
    qResp = await executeContract(useWallet, deploymentDetails.poolLpTokenAddress, executeMsg);
    console.log(`withdraw Liquidity Response - ${qResp['txhash']}`);

    withdrawMsg = {
        withdraw_liquidity : {
            sender: useWallet.key.accAddress,
            amount: lptokens.toString()
        }
    };
    base64Msg = Buffer.from(JSON.stringify(withdrawMsg)).toString('base64');
    executeMsg = {
        send: {
            contract: deploymentDetails.proxyContractAddress,
            amount: "50000",
            msg: base64Msg,
        }
    };
    qResp = await executeContract(useWallet, deploymentDetails.poolLpTokenAddress, executeMsg);
    console.log(`withdraw Liquidity via Proxy Response - ${qResp['txhash']}`);
}


main()