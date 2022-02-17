import {
    mintInitMessage,
    MintingContractPath,
    PairContractPath,
    walletTest1,
    walletTest2,
    walletTest3,
    mint_wallet,
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
        testOperations(deploymentDetails);
        console.log("Finished");
    } catch (error) {
        console.log(error);
    }
    rl.close();

}

const uploadFuryTokenContract = async (deploymentDetails) => {
    if (!deploymentDetails.furyTokenCodeId) {
        let deployFury = false;
        const answer = await question('Do you want to upload Fury Token Contract? (y/N) ');
        if (answer === 'Y' || answer === 'y') {
            deployFury = true;
        } else if (answer === 'N' || answer === 'n') {
            const codeId = await question('Please provide code id for Fury Token contract: ');
            if (isNaN(codeId)) {
                deployFury = true;
            } else {
                deploymentDetails.furyTokenCodeId = codeId;
                deployFury = false;
            }
        } else {
            console.log("Alright! Have fun!! :-)");
        }
        if (deployFury) {
            console.log("Uploading Fury token contract");
            console.log(`mint_wallet = ${mint_wallet.key}`);
            let contractId = await storeCode(mint_wallet, MintingContractPath); // Getting the contract id from local terra
            console.log(`Fury Token Contract ID: ${contractId}`);
            deploymentDetails.furyTokenCodeId = contractId;
            writeArtifact(deploymentDetails, terraClient.chainID);
        }
    }
}

const instantiateFuryTokenContract = async (deploymentDetails) => {
    if (!deploymentDetails.furyContractAddress) {
        let instantiateFury = false;
        const answer = await question('Do you want to instantiate Fury Token Contract? (y/N) ');
        if (answer === 'Y' || answer === 'y') {
            instantiateFury = true;
        } else if (answer === 'N' || answer === 'n') {
            const contractAddress = await question('Please provide contract address for Fury Token contract: ');
            deploymentDetails.furyContractAddress = contractAddress;
            instantiateFury = false;
        }
        if (instantiateFury) {
            console.log("Instantiating Fury token contract");
            let initiate = await instantiateContract(mint_wallet, deploymentDetails.furyTokenCodeId, mintInitMessage)
            // The order is very imp
            let contractAddress = initiate.logs[0].events[0].attributes[3].value;
            console.log(`Fury Token Contract ID: ${contractAddress}`)
            deploymentDetails.furyContractAddress = contractAddress;
            writeArtifact(deploymentDetails, terraClient.chainID);
        }
    }
}


const uploadPairContract = async (deploymentDetails) => {
    if (!deploymentDetails.pairCodeId) {
        console.log("Uploading pair contract (xyk)");
        let contractId = await storeCode(mint_wallet, PairContractPath); // Getting the contract id from local terra
        console.log(`Pair Contract ID: ${contractId}`);
        deploymentDetails.pairCodeId = contractId;
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const uploadStakingContract = async (deploymentDetails) => {
    if (!deploymentDetails.stakingCodeId) {
        console.log("Uploading staking contract");
        let contractId = await storeCode(mint_wallet, StakingContractPath); // Getting the contract id from local terra
        console.log(`Staking Contract ID: ${contractId}`);
        deploymentDetails.stakingCodeId = contractId;
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const instantiateStaking = async (deploymentDetails) => {
    if (!deploymentDetails.stakingAddress || !deploymentDetails.xastroAddress) {
        console.log("Instantiating staking contract");
        let stakingInitMessage = {
            owner: deploymentDetails.adminWallet,
            token_code_id: deploymentDetails.furyTokenCodeId,
            deposit_token_addr: deploymentDetails.furyContractAddress
        }

        let result = await instantiateContract(mint_wallet, deploymentDetails.stakingCodeId, stakingInitMessage)
        // The order is very imp
        let contractAddress = result.logs[0].events[0].attributes.filter(element => element.key == 'contract_address').map(x => x.value);
        deploymentDetails.stakingAddress = contractAddress.shift()
        deploymentDetails.xastroAddress = contractAddress.shift();
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const uploadWhiteListContract = async (deploymentDetails) => {
    if (!deploymentDetails.whitelistCodeId) {
        console.log("Uploading whitelist contract");
        let contractId = await storeCode(mint_wallet, StakingContractPath); // Getting the contract id from local terra
        console.log(`Whitelist Contract ID: ${contractId}`);
        deploymentDetails.whitelistCodeId = contractId;
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const uploadFactoryContract = async (deploymentDetails) => {
    if (!deploymentDetails.factoryCodeId) {
        console.log("Uploading factory contract");
        let contractId = await storeCode(mint_wallet, FactoryContractPath); // Getting the contract id from local terra
        console.log(`Factory Contract ID: ${contractId}`);
        deploymentDetails.factoryCodeId = contractId;
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const instantiateFactory = async (deploymentDetails) => {
    if (!deploymentDetails.factoryAddress) {
        console.log("Instantiating factory contract");
        let factoryInitMessage = {
            owner: deploymentDetails.adminWallet,
            pair_configs: [
                {
                    code_id: deploymentDetails.pairCodeId,
                    pair_type: { "xyk": {} },
                    total_fee_bps: 0,
                    maker_fee_bps: 0
                }
            ],
            token_code_id: deploymentDetails.furyTokenCodeId,
            whitelist_code_id: deploymentDetails.whitelistCodeId
        }
        console.log(JSON.stringify(factoryInitMessage, null, 2));
        let result = await instantiateContract(mint_wallet, deploymentDetails.factoryCodeId, factoryInitMessage);
        let contractAddresses = result.logs[0].events[0].attributes.filter(element => element.key == 'contract_address').map(x => x.value);
        deploymentDetails.factoryAddress = contractAddresses.shift();
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const uploadProxyContract = async (deploymentDetails) => {
    if (!deploymentDetails.proxyCodeId) {
        console.log("Uploading proxy contract");
        let contractId = await storeCode(mint_wallet, ProxyContractPath); // Getting the contract id from local terra
        console.log(`Proxy Contract ID: ${contractId}`);
        deploymentDetails.proxyCodeId = contractId;
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const instantiateProxyContract = async (deploymentDetails) => {
    if (!deploymentDetails.proxyContractAddress) {
        console.log("Instantiating proxy contract");
        let proxyInitMessage = {
            admin_address: deploymentDetails.adminWallet,
            /// contract address of Fury token
            custom_token_address: deploymentDetails.furyContractAddress,
            authorized_liquidity_provider: deploymentDetails.adminWallet,
            swap_opening_date: "1644734115627110527",
        }
        console.log(JSON.stringify(proxyInitMessage, null, 2));
        let result = await instantiateContract(mint_wallet, deploymentDetails.proxyCodeId, proxyInitMessage);
        let contractAddresses = result.logs[0].events[0].attributes.filter(element => element.key == 'contract_address').map(x => x.value);
        deploymentDetails.proxyContractAddress = contractAddresses.shift();
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const createPoolPairs = async (deploymentDetails) => {
    if (!deploymentDetails.poolPairContractAddress) {
        let init_param = { proxy: deploymentDetails.proxyContractAddress };
        console.log(`init_param = ${JSON.stringify(init_param)}`);
        console.log(Buffer.from(JSON.stringify(init_param)).toString('base64'));
        let executeMsg = {
            create_pair: {
                pair_type: { xyk: {} },
                asset_infos: [
                    {
                        token: {
                            contract_addr: deploymentDetails.furyContractAddress
                        }
                    },
                    {
                        native_token: { denom: "uusd" }
                    }
                ],
                init_params: Buffer.from(JSON.stringify(init_param)).toString('base64')
            }
        };
        console.log(`executeMsg = ${executeMsg}`);
        let response = await executeContract(mint_wallet, deploymentDetails.factoryAddress, executeMsg);

        deploymentDetails.poolPairContractAddress = response.logs[0].eventsByType.from_contract.pair_contract_addr[0]

        let pool_info = await queryContract(deploymentDetails.poolPairContractAddress, {
            pair: {}
        })

        deploymentDetails.poolLpTokenAddress = pool_info.liquidity_token;

        console.log(`Pair successfully created! Address: ${deploymentDetails.poolPairContractAddress}`);
        writeArtifact(deploymentDetails, terraClient.chainID);
        executeMsg = {
            configure: {
                admin_address: deploymentDetails.adminWallet,
                pool_pair_address: deploymentDetails.poolPairContractAddress,
                custom_token_address: deploymentDetails.furyContractAddress,
                liquidity_token: deploymentDetails.poolLpTokenAddress,
                authorized_liquidity_provider: deploymentDetails.adminWallet,
                swap_opening_date: "1644734115627110528",
            }
        };
        console.log(`Proxy config - executeMsg = ${executeMsg}`);
        response = await executeContract(mint_wallet, deploymentDetails.proxyContractAddress, executeMsg);
    }
}

const savePairAddressToProxy = async (deploymentDetails) => {
    if (!deploymentDetails.poolpairSavedToProxy) {
        //Fetch configuration
        let configResponse = await queryContract(deploymentDetails.proxyContractAddress, {
            configuration: {}
        });
        configResponse.pool_pair_address = deploymentDetails.poolPairContractAddress;
        console.log(`Configuration = ${JSON.stringify(configResponse)}`);
        let executeMsg = {
            configure: configResponse
        };
        console.log(`executeMsg = ${executeMsg}`);
        let response = await executeContract(mint_wallet, deploymentDetails.proxyContractAddress, executeMsg);
        console.log(`Save Response - ${response['txhash']}`);
        deploymentDetails.poolpairSavedToProxy = true;
        writeArtifact(deploymentDetails, terraClient.chainID)
    }
}

const performOperations = async (deploymentDetails) => {
    checkLPTokenDetails(deploymentDetails).then(() => {
        provideLiquidity(deploymentDetails).then(() => {
            queryPool(deploymentDetails).then(() => {
                performSimulation(deploymentDetails).then(() => {
                    performSwap(deploymentDetails).then(() => {
                        //withdrawLiquidity(deploymentDetails).then(() => {
                            console.log("Finished pipe!");
                        //});
                    });
                });
            });
        });
    });
}

const testOperations = async (deploymentDetails) => {
    // checkLPTokenDetails(deploymentDetails).then(() => {
    //     queryPool(deploymentDetails).then(() => {
    //         performSimulation(deploymentDetails).then(() => {
                withdrawLiquidity(deploymentDetails).then(() => {
                    console.log("Finished pipe!");
                });
    //         });
    //     });
    // });
}



const withdrawLiquidity = async (deploymentDetails) => {

    console.log(`Starting withdraw test on astro_pair directly`);

    let qResp = await queryContract(deploymentDetails.furyContractAddress, {
        balance: { address : deploymentDetails.adminWallet }
    });
    console.log(`fury balance adminWallet = ${qResp.balance}`);
    qResp = await queryContract(deploymentDetails.poolLpTokenAddress, {
        balance: { address : deploymentDetails.adminWallet }
    });
    console.log(`lptoken balance adminWallet = ${qResp.balance}`);
    qResp = await queryContract(deploymentDetails.proxyContractAddress, {
        pool: {}
    });
    //let furyAmount = Math.ceil(Number(qResp.assets[0].amount) / 100);
    //let ustAmount = Math.ceil(Number(qResp.assets[1].amount) / 100);
    let furyAmount = Math.ceil(Number(qResp.assets[0].amount));
    let ustAmount = Math.ceil(Number(qResp.assets[1].amount));
    console.log(`query pool response = ${JSON.stringify(qResp)}`);
    console.log(`uusd ${ustAmount}, fury ${furyAmount.toString()}, fury_price_in_ust ${ustAmount/furyAmount}`);


    // let qResp = await queryContract(deploymentDetails.furyContractAddress, {
    //     allowance: {
    //         owner : deploymentDetails.adminWallet,
    //         spender : deploymentDetails.poolPairContractAddress
    //     }
    // });
    // console.log(`query allowance response hash = ${JSON.stringify(qResp)}`);
    // let decreaseAllowanceMsg = {
    //     decrease_allowance: {
    //         spender: deploymentDetails.proxyContractAddress,
    //         amount: "154997301"
    //     }
    // };
    // let decrAllowResp = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, decreaseAllowanceMsg);
    // console.log(`Decrease allowance at astro_pair directly response hash = ${decrAllowResp['txhash']}`);

    // let qResp = await queryContract(deploymentDetails.furyContractAddress, {
    //     allowance: {
    //         owner : deploymentDetails.adminWallet,
    //         spender : deploymentDetails.poolPairContractAddress
    //     }
    // });
    // console.log(`query allowance poolPair response hash = ${JSON.stringify(qResp)}`);
    qResp = await queryContract(deploymentDetails.furyContractAddress, {
        allowance: {
            owner : deploymentDetails.adminWallet,
            spender : deploymentDetails.proxyContractAddress
        }
    });
    console.log(`query allowance admin-proxy response hash = ${JSON.stringify(qResp)}`);
    qResp = await queryContract(deploymentDetails.furyContractAddress, {
        allowance: {
            owner : deploymentDetails.proxyContractAddress,
            spender : deploymentDetails.poolPairContractAddress
        }
    });
    console.log(`query allowance proxy-pool response hash = ${JSON.stringify(qResp)}`);

    // ASTRO-POOL 

    // let increaseAllowanceMsg = {
    //     increase_allowance: {
    //         spender: deploymentDetails.poolPairContractAddress,
    //         amount: "1000000"
    //     }
    // };
    // let incrAllowResp = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsg);
    // console.log(`Increase allowance at astro_pair directly response hash = ${incrAllowResp['txhash']}`);
    // let executeMsg = {
    //     provide_liquidity: {
    //         assets: [
    //             {
    //                 info: {
    //                     native_token: {
    //                         denom: "uusd"
    //                     }
    //                 },
    //                 amount: "1000000"
    //             },
    //             {
    //                 info: {
    //                     token: {
    //                         contract_addr: deploymentDetails.furyContractAddress
    //                     }
    //                 },
    //                 amount: "1000000"
    //             }
    //         ],
    //         receiver: deploymentDetails.adminWallet
    //     }
    // };
    // let response = await executeContract(mint_wallet, deploymentDetails.poolPairContractAddress, executeMsg, { 'uusd': 1000000 });
    // console.log(`Save provide_liquidity at astro_pair directly Response - ${response['txhash']}`);

    // console.log(`Starting withdraw test on proxy`);


   // PROXY 

   furyAmount = Math.ceil(furyAmount/10000)
   ustAmount = Math.ceil(ustAmount/10000)
   let ustTax = Math.ceil(ustAmount/1000)
   let increaseAllowanceMsg = {
        increase_allowance: {
            spender: deploymentDetails.proxyContractAddress,
            amount: furyAmount.toString()
        }
    };
    let incrAllowResp = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsg);
    console.log(`Increase allowance - fury - ${furyAmount} at proxy response hash = ${incrAllowResp['txhash']}`);
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
            receiver: deploymentDetails.adminWallet,
            slippage_tolerance:"0.1",
        }
    };
    console.log(`uust - ${ustAmount} + tax uusd ${ustTax}`);
    let response = await executeContract(mint_wallet, deploymentDetails.proxyContractAddress, executeMsg, { 'uusd': ustAmount+ustTax });
    let lptokens = response.logs[0].eventsByType.wasm.share[0]
    console.log(`lptokens - ${lptokens}`);
    console.log(`Save provide_liquidity at proxy Response - ${response['txhash']}`);
    //  let contractAddress = result.logs[0].events[0].attributes.filter(element => element.key == 'contract_address').map(x => x.value);
    //  deploymentDetails.poolPairContractAddress = response.logs[0].eventsByType.from_contract.pair_contract_addr[0]

    let withdrawMsg = {
        withdraw_liquidity : {
            sender: deploymentDetails.adminWallet,
            amount:"1000000"
        }
    };
    let base64Msg = Buffer.from(JSON.stringify(withdrawMsg)).toString('base64');
    executeMsg = {
        send: {
            contract: deploymentDetails.proxyContractAddress,
            amount: "1000000",
            msg: base64Msg,
        }
    };
    response = await executeContract(mint_wallet, deploymentDetails.poolLpTokenAddress, executeMsg);
    console.log(`withdraw Liquidity Response - ${response['txhash']}`);
}

const checkLPTokenDetails = async (deploymentDetails) => {
    let lpTokenDetails = await queryContract(deploymentDetails.poolLpTokenAddress, {
        token_info: {}
    });
    console.log(JSON.stringify(lpTokenDetails));
    assert.equal(lpTokenDetails['name'], "FURY-UUSD-LP");
}

const provideLiquidity = async (deploymentDetails) => {
    //First increase allowance for proxy to spend from mint_wallet wallet
    let increaseAllowanceMsg = {
        increase_allowance: {
            spender: deploymentDetails.proxyContractAddress,
            amount: "5000000000"
        }
    };
    let incrAllowResp = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsg);
    console.log(`Increase allowance response hash = ${incrAllowResp['txhash']}`);
    let executeMsg = {
        provide_liquidity: {
            assets: [
                {
                    info: {
                        native_token: {
                            denom: "uusd"
                        }
                    },
                    amount: "500000000"
                },
                {
                    info: {
                        token: {
                            contract_addr: deploymentDetails.furyContractAddress
                        }
                    },
                    amount: "5000000000"
                }
            ],
            receiver: deploymentDetails.adminWallet
        }
    };
    let response = await executeContract(mint_wallet, deploymentDetails.proxyContractAddress, executeMsg, { 'uusd': 500500000 });
    console.log(`Save Response - ${response['txhash']}`);
}

const queryPool = async (deploymentDetails) => {
    console.log("querying pool details");
    let poolDetails = await queryContract(deploymentDetails.proxyContractAddress, {
        pool: {}
    });
    console.log(JSON.stringify(poolDetails));
}

const performSimulation = async (deploymentDetails) => {
    simulationOfferNative(deploymentDetails).then(() => {
        simulationOfferFury(deploymentDetails).then(() => {
            reverseSimulationAskNative(deploymentDetails).then(() => {
                reverseSimulationAskFury(deploymentDetails);
            });
        });
    });
}

const performSwap = async (deploymentDetails) => {
    buyFuryTokens(deploymentDetails).then(() => {
        sellFuryTokens(deploymentDetails).then(() => {

        });
    });
}

const buyFuryTokens = async (deploymentDetails) => {
    let buyFuryMsg = {
        swap: {
            sender: mint_wallet.key.accAddress,
            offer_asset: {
                info: {
                    native_token: {
                        denom: "uusd"
                    }
                },
                amount: "10000"
            }
        }
    };
    let buyFuryResp = await executeContract(mint_wallet, deploymentDetails.proxyContractAddress, buyFuryMsg, { 'uusd': 10010 });
    console.log(`Buy Fury swap response tx hash = ${buyFuryResp['txhash']}`);
}

const sellFuryTokens = async (deploymentDetails) => {
    let swapMsg = {
        swap: {
            sender: mint_wallet.key.accAddress,
            offer_asset: {
                info: {
                    token: {
                        contract_addr: deploymentDetails.furyContractAddress
                    }
                },
                amount: "10000"
            }
        }
    };
    let base64Msg = Buffer.from(JSON.stringify(swapMsg)).toString('base64');

    let sendMsg = {
        send: {
            contract: deploymentDetails.proxyContractAddress,
            amount: "10000",
            msg: base64Msg
        }
    };
    let sellFuryResp = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, sendMsg);
    console.log(`Sell Fury swap response tx hash = ${sellFuryResp['txhash']}`);
}

const simulationOfferNative = async (deploymentDetails) => {
    console.log("performing simulation for offering native coins");
    let simulationResult = await queryContract(deploymentDetails.proxyContractAddress, {
        simulation: {
            offer_asset: {
                info: {
                    native_token: {
                        denom: "uusd"
                    }
                },
                amount: "100000000"
            }
        }
    });
    console.log(JSON.stringify(simulationResult));
}

const simulationOfferFury = async (deploymentDetails) => {
    console.log("performing simulation for offering Fury tokens");
    let simulationResult = await queryContract(deploymentDetails.proxyContractAddress, {
        simulation: {
            offer_asset: {
                info: {
                    token: {
                        contract_addr: deploymentDetails.furyContractAddress
                    }
                },
                amount: "100000000"
            }
        }
    });
    console.log(JSON.stringify(simulationResult));
}

const reverseSimulationAskNative = async (deploymentDetails) => {
    console.log("performing reverse simulation asking for native coins");
    let simulationResult = await queryContract(deploymentDetails.proxyContractAddress, {
        reverse_simulation: {
            ask_asset: {
                info: {
                    native_token: {
                        denom: "uusd"
                    }
                },
                amount: "1000000"
            }
        }
    });
    console.log(JSON.stringify(simulationResult));
}

const reverseSimulationAskFury = async (deploymentDetails) => {
    console.log("performing reverse simulation asking for Fury tokens");
    let simulationResult = await queryContract(deploymentDetails.proxyContractAddress, {
        reverse_simulation: {
            ask_asset: {
                info: {
                    token: {
                        contract_addr: deploymentDetails.furyContractAddress
                    }
                },
                amount: "1000000"
            }
        }
    });
    console.log(JSON.stringify(simulationResult));
}


main()