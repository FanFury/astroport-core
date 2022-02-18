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
    treasury_wallet,
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
    try {
        terraClient.chainID = "localterra";
        let deploymentDetails = readArtifact(terraClient.chainID);
        const primeAccounts = await question('Do you want to preload custom accounts? (y/N) ');
        if (primeAccounts === 'Y' || primeAccounts === 'y') {
            primeAccountsWithFunds().then((txHash) => {
                console.log(txHash);
                proceedToSetup(deploymentDetails);
            });
        } else {
            proceedToSetup(deploymentDetails);
        }
    } catch (error) {
        console.log(error);
    }
}

const proceedToSetup = async (deploymentDetails) => {
    const startFresh = await question('Do you want to upload and deploy fresh? (y/N)');
    if (startFresh === 'Y' || startFresh === 'y') {
        deploymentDetails = {};
    }
    if (!deploymentDetails.adminWallet) {
        deploymentDetails.adminWallet = mint_wallet.key.accAddress;
    }
    if (!deploymentDetails.authLiquidityProvider) {
        deploymentDetails.authLiquidityProvider = treasury_wallet.key.accAddress;
    }
    if (!deploymentDetails.defaultLPTokenHolder) {
        deploymentDetails.defaultLPTokenHolder = liquidity_wallet.key.accAddress;
    }
    uploadFuryTokenContract(deploymentDetails).then(() => {
        instantiateFuryTokenContract(deploymentDetails).then(() => {
            transferFuryToTreasury(deploymentDetails).then(() => {
                transferFuryToMarketing(deploymentDetails).then(() => {
                    uploadPairContract(deploymentDetails).then(() => {
                        uploadStakingContract(deploymentDetails).then(() => {
                            instantiateStaking(deploymentDetails).then(() => {
                                uploadWhiteListContract(deploymentDetails).then(() => {
                                    uploadFactoryContract(deploymentDetails).then(() => {
                                        instantiateFactory(deploymentDetails).then(() => {
                                            uploadProxyContract(deploymentDetails).then(() => {
                                                instantiateProxyContract(deploymentDetails).then(() => {
                                                    queryPorxyConfiguration(deploymentDetails).then(() => {
                                                        createPoolPairs(deploymentDetails).then(() => {
                                                            savePairAddressToProxy(deploymentDetails).then(() => {
                                                                queryPorxyConfiguration(deploymentDetails).then(() => {
                                                                    console.log("deploymentDetails = " + JSON.stringify(deploymentDetails, null, ' '));
                                                                    rl.close();
                                                                    performOperations(deploymentDetails);
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

const uploadFuryTokenContract = async (deploymentDetails) => {
    console.log(`terraClient.chainID = ${terraClient.chainID}`);
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

const transferFuryToTreasury = async (deploymentDetails) => {
    let transferFuryToTreasuryMsg = {
        transfer: {
            recipient: treasury_wallet.key.accAddress,
            amount: "5000000000"
        }
    };
    console.log(`transferFuryToTreasuryMsg = ${JSON.stringify(transferFuryToTreasuryMsg)}`);
    let response = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, transferFuryToTreasuryMsg);
    console.log(`transferFuryToTreasuryMsg Response - ${response['txhash']}`);
}

const transferFuryToMarketing = async (deploymentDetails) => {
    let transferFuryToMarketingMsg = {
        transfer: {
            recipient: marketing_wallet.key.accAddress,
            amount: "50000000"
        }
    };
    console.log(`transferFuryToMarketingMsg = ${JSON.stringify(transferFuryToMarketingMsg)}`);
    let response = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, transferFuryToMarketingMsg);
    console.log(`transferFuryToMarketingMsg Response - ${response['txhash']}`);
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
            custom_token_address: deploymentDetails.furyContractAddress,
            authorized_liquidity_provider: deploymentDetails.authLiquidityProvider,
            default_lp_tokens_holder: deploymentDetails.defaultLPTokenHolder,
            swap_opening_date: "1644734115627110527",
            pair_discount_rate: 700,
            pair_bonding_period_in_days: 5,
            pair_fury_provider: liquidity_reward_wallet.key.accAddress,
            native_discount_rate: 500,
            native_bonding_period_in_days: 7,
            native_fury_provider: bonded_reward_wallet.key.accAddress,
            default_lp_tokens_holder: treasury_wallet.key.accAddress,

        }
        console.log(JSON.stringify(proxyInitMessage, null, 2));
        let result = await instantiateContract(mint_wallet, deploymentDetails.proxyCodeId, proxyInitMessage);
        let contractAddresses = result.logs[0].events[0].attributes.filter(element => element.key == 'contract_address').map(x => x.value);
        deploymentDetails.proxyContractAddress = contractAddresses.shift();
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const queryPorxyConfiguration = async (deploymentDetails) => {
    //Fetch configuration
    let configResponse = await queryContract(deploymentDetails.proxyContractAddress, {
        configuration: {}
    });
    console.log(JSON.stringify(configResponse));
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
                pool_pair_address: deploymentDetails.poolPairContractAddress,
                liquidity_token: deploymentDetails.poolLpTokenAddress,
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
        checkLPTokenBalances(deploymentDetails).then(() => {
            provideLiquidityAuthorised(deploymentDetails).then(() => {
                checkLPTokenBalances(deploymentDetails).then(() => {
                    queryPool(deploymentDetails).then(() => {
                        performSimulation(deploymentDetails).then(() => {
                            performSwap(deploymentDetails).then(() => {
                                checkLPTokenBalances(deploymentDetails).then(() => {
                                    provideLiquidityGeneral(deploymentDetails).then(() => {
                                        checkLPTokenBalances(deploymentDetails).then(() => {
                                            console.log("Finished operations");
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}
const checkLPTokenDetails = async (deploymentDetails) => {
    let lpTokenDetails = await queryContract(deploymentDetails.poolLpTokenAddress, {
        token_info: {}
    });
    console.log(JSON.stringify(lpTokenDetails));
    assert.equal(lpTokenDetails['name'], "FURY-UUSD-LP");
}

const checkLPTokenBalances = async (deploymentDetails) => {
    console.log("Getting LPToken balances");
    await queryContract(deploymentDetails.poolLpTokenAddress, {
        all_accounts: {}
    }).then((allAccounts) => {
        console.log(JSON.stringify(allAccounts.accounts));
        queryContract(deploymentDetails.poolLpTokenAddress, {
            balance: { address: allAccounts.accounts[0] }
        }).then((balance0) => {
            console.log(`Balance of ${allAccounts.accounts[0]} : ${JSON.stringify(balance0)}`);
            queryContract(deploymentDetails.poolLpTokenAddress, {
                balance: { address: allAccounts.accounts[1] }
            }).then((balance1) => {
                console.log(`Balance of ${allAccounts.accounts[1]} : ${JSON.stringify(balance1)}`);
            });
        });
    // allAccounts.accounts.forEach((account) => {
        //     let balance = await queryContract(deploymentDetails.poolLpTokenAddress, {
        //         balance: { address: account }
        //     });
        //     console.log(`Balance of ${account} : ${JSON.stringify(balance)}`);
        // });
    });
}

const provideLiquidityAuthorised = async (deploymentDetails) => {
    //First increase allowance for proxy to spend from mint_wallet wallet
    let increaseAllowanceMsg = {
        increase_allowance: {
            spender: deploymentDetails.proxyContractAddress,
            amount: "5000000000"
        }
    };
    let incrAllowResp = await executeContract(treasury_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsg);
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
    let tax = await terraClient.utils.calculateTax(new Coin("uusd", "500000000"));
    console.log(`tax = ${tax}`);
    let funds = Number(500000000);
    funds = funds + Number(tax.amount);
    console.log(`funds = ${funds}`);
    let response = await executeContract(treasury_wallet, deploymentDetails.proxyContractAddress, executeMsg, { 'uusd': funds });
    console.log(`Provide Liquidity (from treasury) Response - ${response['txhash']}`);
}

const provideLiquidityGeneral = async (deploymentDetails) => {
    //First increase allowance for proxy to spend from marketing_wallet wallet
    let increaseAllowanceMsg = {
        increase_allowance: {
            spender: deploymentDetails.proxyContractAddress,
            amount: "50000000"
        }
    };
    let incrAllowResp = await executeContract(marketing_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsg);
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
                    amount: "5000000"
                },
                {
                    info: {
                        token: {
                            contract_addr: deploymentDetails.furyContractAddress
                        }
                    },
                    amount: "50000000"
                }
            ]
        }
    };
    let tax = await terraClient.utils.calculateTax(new Coin("uusd", "5000000"));
    console.log(`tax = ${tax}`);
    let funds = Number(5000000);
    funds = funds + Number(tax.amount);
    console.log(`funds = ${funds}`);
    let response = await executeContract(marketing_wallet, deploymentDetails.proxyContractAddress, executeMsg, { 'uusd': funds });
    console.log(`Provide Liquidity (from marketing) Response - ${response['txhash']}`);
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
                amount: "1000000"
            }
        }
    };
    let base64Msg = Buffer.from(JSON.stringify(swapMsg)).toString('base64');
    console.log(`Sell Fury swap base64 msg = ${base64Msg}`);

    let sendMsg = {
        send: {
            contract: deploymentDetails.proxyContractAddress,
            amount: "1000000",
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