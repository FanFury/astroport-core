import {
    mintInitMessage,
    MintingContractPath,
    PairContractPath,
    walletTest1,
    walletTest2,
    walletTest3,
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

let configResponseReceived;

const main = async () => {
    try {
        terraClient.chainID = "bombay-12";
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
    const sleep_time = 31000;

    uploadFuryTokenContract(deploymentDetails).then(() => {
        setTimeout(() => {
            instantiateFuryTokenContract(deploymentDetails).then(() => {
                setTimeout(() => {
                    transferFuryToTreasury(deploymentDetails).then(() => {
                        setTimeout(() => {
                            transferFuryToMarketing(deploymentDetails).then(() => {
                                setTimeout(() => {
                                    transferFuryToLiquidity(deploymentDetails).then(() => {
                                        setTimeout(() => {
                                            uploadPairContract(deploymentDetails).then(() => {
                                                setTimeout(() => {
                                                    uploadStakingContract(deploymentDetails).then(() => {
                                                        setTimeout(() => {
                                                            instantiateStaking(deploymentDetails).then(() => {
                                                                setTimeout(() => {
                                                                    uploadWhiteListContract(deploymentDetails).then(() => {
                                                                        setTimeout(() => {
                                                                            uploadFactoryContract(deploymentDetails).then(() => {
                                                                                setTimeout(() => {
                                                                                    instantiateFactory(deploymentDetails).then(() => {
                                                                                        setTimeout(() => {
                                                                                            uploadProxyContract(deploymentDetails).then(() => {
                                                                                                setTimeout(() => {
                                                                                                    instantiateProxyContract(deploymentDetails).then(() => {
                                                                                                        setTimeout(() => {
                                                                                                            queryProxyConfiguration(deploymentDetails).then(() => {
                                                                                                                setTimeout(() => {
                                                                                                                    createPoolPairs(deploymentDetails).then(() => {
                                                                                                                        setTimeout(() => {
                                                                                                                            savePairAddressToProxy(deploymentDetails).then(() => {
                                                                                                                                setTimeout(() => {
                                                                                                                                    queryProxyConfiguration(deploymentDetails).then(() => {
                                                                                                                                        setTimeout(() => {
                                                                                                                                            performOperations(deploymentDetails).then(() => {
                                                                                                                                                setTimeout(() => {
                                                                                                                                                    console.log("deploymentDetails = " + JSON.stringify(deploymentDetails, null, ' '));
                                                                                                                                                }, sleep_time);
                                                                                                                                            });
                                                                                                                                        }, sleep_time);
                                                                                                                                    });
                                                                                                                                }, sleep_time);
                                                                                                                            });
                                                                                                                        }, sleep_time);
                                                                                                                    });
                                                                                                                }, sleep_time);
                                                                                                            });
                                                                                                        }, sleep_time);
                                                                                                    });
                                                                                                }, sleep_time);
                                                                                            });
                                                                                        }, sleep_time);
                                                                                    });
                                                                                }, sleep_time);
                                                                            });
                                                                        }, sleep_time);
                                                                    });
                                                                }, sleep_time);
                                                            });
                                                        }, sleep_time);
                                                    });
                                                }, sleep_time);
                                            });
                                        }, sleep_time);
                                    });
                                }, sleep_time);
                            });
                        }, sleep_time);
                    });
                }, sleep_time);
            });
        }, sleep_time);
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

const transferFuryToLiquidity = async (deploymentDetails) => {
    let transferFuryToLiquidityMsg = {
        transfer: {
            recipient: liquidity_wallet.key.accAddress,
            amount: "50000000"
        }
    };
    console.log(`transferFuryToLiquidityMsg = ${JSON.stringify(transferFuryToLiquidityMsg)}`);
    let response = await executeContract(mint_wallet, deploymentDetails.furyContractAddress, transferFuryToLiquidityMsg);
    console.log(`transferFuryToLiquidityMsg Response - ${response['txhash']}`);
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
            /// contract address of Fury token
            custom_token_address: deploymentDetails.furyContractAddress,

            /// discount_rate when fury and UST are both provided
            pair_discount_rate: 500,
            /// bonding period when fury and UST are both provided TODO 7*24*60*60
            pair_bonding_period_in_sec: 7 * 60,
            /// Fury tokens for balanced investment will be fetched from this wallet
            pair_fury_reward_wallet: liquidity_wallet.key.accAddress,
            /// The LP tokens for all liquidity providers except
            /// authorised_liquidity_provider will be stored to this address
            /// The LPTokens for balanced investment are delivered to this wallet
            pair_lp_tokens_holder: liquidity_wallet.key.accAddress,

            /// discount_rate when only UST are both provided
            native_discount_rate: 700,
            /// bonding period when only UST provided TODO 5*24*60*60
            native_bonding_period_in_sec: 5 * 60,
            /// Fury tokens for native(UST only) investment will be fetched from this wallet
            native_investment_reward_wallet: treasury_wallet.key.accAddress,
            /// The native(UST only) investment will be stored into this wallet
            native_investment_receive_wallet: treasury_wallet.key.accAddress,

            /// This address has the authority to pump in liquidity
            /// The LP tokens for this address will be returned to this address
            authorized_liquidity_provider: deploymentDetails.authLiquidityProvider,
            ///Time in nano seconds since EPOC when the swapping will be enabled
            swap_opening_date: "1644734115627110528",

            /// Pool pair contract address of astroport
            pool_pair_address: deploymentDetails.poolPairContractAddress,
        }
        console.log(JSON.stringify(proxyInitMessage, null, 2));
        let result = await instantiateContract(mint_wallet, deploymentDetails.proxyCodeId, proxyInitMessage);
        let contractAddresses = result.logs[0].events[0].attributes.filter(element => element.key == 'contract_address').map(x => x.value);
        deploymentDetails.proxyContractAddress = contractAddresses.shift();
        writeArtifact(deploymentDetails, terraClient.chainID);
    }
}

const queryProxyConfiguration = async (deploymentDetails) => {
    //Fetch configuration
    let configResponse = await queryContract(deploymentDetails.proxyContractAddress, {
        configuration: {}
    });
    configResponseReceived = configResponse;
    console.log(JSON.stringify(configResponseReceived));
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

        deploymentDetails.poolLpTokenAddress = pool_info.liquidity_token

        console.log(`Pair successfully created! Address: ${deploymentDetails.poolPairContractAddress}`)
        writeArtifact(deploymentDetails, terraClient.chainID)
    }
}

const savePairAddressToProxy = async (deploymentDetails) => {
    if (!deploymentDetails.poolpairSavedToProxy) {
        //Fetch configuration
        let configResponse = await queryContract(deploymentDetails.proxyContractAddress, {
            configuration: {}
        });
        configResponse.pool_pair_address = deploymentDetails.poolPairContractAddress;
        configResponse.liquidity_token = deploymentDetails.poolLpTokenAddress;
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
            transferFuryToTreasury(deploymentDetails).then(() => {
                provideLiquidityAuthorised(deploymentDetails).then(() => {
                    checkLPTokenBalances(deploymentDetails).then(() => {
                        queryPool(deploymentDetails).then(() => {
                            performSimulation(deploymentDetails).then(() => {
                                buyFuryTokens(deploymentDetails).then(() => {
                                    sellFuryTokens(deploymentDetails).then(() => {
                                        withdrawLiquidityAutorized(deploymentDetails).then(() => {
                                            checkLPTokenBalances(deploymentDetails).then(() => {
                                                provideNativeForRewards(deploymentDetails).then(() => {
                                                    providePairForReward(deploymentDetails).then(() => {
                                                        checkLPTokenBalances(deploymentDetails).then(() => {
                                                            queryInvestmentReward(deploymentDetails).then(() => {
                                                                console.log("Finished operations");
                                                                rl.close();
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
        allAccounts.accounts.forEach((account) => {
            queryContract(deploymentDetails.poolLpTokenAddress, {
                balance: { address: account }
            }).then((balance) => {
                console.log(`Balance of ${account} : ${JSON.stringify(balance)}`);
            });
        });
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
            ]
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

const withdrawLiquidityAutorized = async (deploymentDetails) => {
    console.log(`withdraw liquidity using lptokens = 1000000000`);
    let withdrawMsg = {
        withdraw_liquidity: {
            sender: deploymentDetails.authLiquidityProvider,
            amount: "1000000000"
        }
    };
    let base64Msg = Buffer.from(JSON.stringify(withdrawMsg)).toString('base64');
    let executeMsg = {
        send: {
            contract: deploymentDetails.proxyContractAddress,
            amount: "1000000000",
            msg: base64Msg,
        }
    };
    let qResp = await executeContract(treasury_wallet, deploymentDetails.poolLpTokenAddress, executeMsg);
    console.log(`withdraw Liquidity (from treasury) Response - ${qResp['txhash']}`);
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

const providePairForReward = async (deploymentDetails) => {
    //Get the pool details
    let ufuryCount;
    let uustCount;
    let poolDetails = await queryContract(deploymentDetails.proxyContractAddress, {
        pool: {}
    });
    poolDetails.assets.forEach(asset => {
        console.log(`asset = ${JSON.stringify(asset)}`);
        if (asset.info.native_token) {
            uustCount = asset.amount;
            console.log("Native Tokens = " + uustCount + asset.info.native_token.denom);
        }
        if (asset.info.token) {
            ufuryCount = asset.amount;
            console.log("Fury Tokens = " + ufuryCount + "uFury");
        }
    })

    let hundredPercent = Number(10000);
    let rate = hundredPercent - configResponseReceived.pair_discount_rate;
    let baseUstAmount = Number(5000);
    let furyForBaseUst = parseInt(baseUstAmount * Number(ufuryCount) / Number(uustCount));
    let totalFuryAmount = furyForBaseUst * Number(2);
    let incrAllowLW = parseInt(totalFuryAmount * hundredPercent / rate);
    console.log(`Increase allowance for liquidity by = ${incrAllowLW}`);
    //First increase allowance for proxy to spend from liquidity wallet
    let increaseAllowanceMsgLW = {
        increase_allowance: {
            spender: deploymentDetails.proxyContractAddress,
            amount: incrAllowLW.toString()
        }
    };
    let incrAllowRespLW = await executeContract(liquidity_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsgLW);
    console.log(`Increase allowance response hash = ${incrAllowRespLW['txhash']}`);

    //First increase allowance for proxy to spend from marketing_wallet wallet
    let increaseAllowanceMsg = {
        increase_allowance: {
            spender: deploymentDetails.proxyContractAddress,
            amount: furyForBaseUst.toString()
        }
    };
    let incrAllowResp = await executeContract(marketing_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsg);
    console.log(`Increase allowance response hash = ${incrAllowResp['txhash']}`);
    let executeMsg = {
        provide_pair_for_reward: {
            assets: [
                {
                    info: {
                        native_token: {
                            denom: "uusd"
                        }
                    },
                    amount: baseUstAmount.toString()
                },
                {
                    info: {
                        token: {
                            contract_addr: deploymentDetails.furyContractAddress
                        }
                    },
                    amount: furyForBaseUst.toString()
                }
            ]
        }
    };
    let tax = await terraClient.utils.calculateTax(new Coin("uusd", baseUstAmount.toString()));
    console.log(`tax = ${tax}`);
    let funds = baseUstAmount + Number(tax.amount);
    console.log(`funds = ${funds}`);
    let response = await executeContract(marketing_wallet, deploymentDetails.proxyContractAddress, executeMsg, { 'uusd': funds });
    console.log(`Provide Liquidity (from marketing) Response - ${response['txhash']}`);
}

const claimInvestmentReward = async (deploymentDetails) => {
    let qRes = await queryContract(deploymentDetails.proxyContractAddress, {
        get_bonding_details: {
            user_address: marketing_wallet.key.accAddress
        }
    });
    console.log(`bonded reward query ${JSON.stringify(qRes)}`);

    let eMsg = {
        reward_claim: {
            receiver: marketing_wallet.key.accAddress,
            withdrawal_amount: "159083",
        }
    };
    console.log(`eMsg = ${JSON.stringify(eMsg)}`);
    let response = await executeContract(marketing_wallet, deploymentDetails.proxyContractAddress, eMsg);
    console.log(`eMsg Response - ${response['txhash']}`);
}

const provideNativeForRewards = async (deploymentDetails) => {
    //Get the pool details
    let ufuryCount;
    let uustCount;
    let poolDetails = await queryContract(deploymentDetails.proxyContractAddress, {
        pool: {}
    });
    poolDetails.assets.forEach(asset => {
        console.log(`asset = ${JSON.stringify(asset)}`);
        if (asset.info.native_token) {
            uustCount = asset.amount;
            console.log("Native Tokens = " + uustCount + asset.info.native_token.denom);
        }
        if (asset.info.token) {
            ufuryCount = asset.amount;
            console.log("Fury Tokens = " + ufuryCount + "uFury");
        }
    })

    let hundredPercent = Number(10000);
    let rate = hundredPercent - configResponseReceived.native_discount_rate;
    let baseUstAmount = Number(5000);
    let furyForBaseUst = baseUstAmount * Number(ufuryCount) / Number(uustCount);
    console.log(`for ${baseUstAmount} the equivalent furys are ${furyForBaseUst}`);
    // let ustFuryEquivAmount = baseUstAmount * Number(10); // 10x of ust is fury and then total = fury + ust
    // let totalFuryAmount = ustFuryEquivAmount;
    let incrAllowLW = parseInt(furyForBaseUst * hundredPercent / rate);
    console.log(`Increase allowance for treasury by = ${incrAllowLW}`);
    //First increase allowance for proxy to spend from treasury wallet
    let increaseAllowanceMsgLW = {
        increase_allowance: {
            spender: deploymentDetails.proxyContractAddress,
            amount: incrAllowLW.toString()
        }
    };
    let incrAllowRespLW = await executeContract(treasury_wallet, deploymentDetails.furyContractAddress, increaseAllowanceMsgLW);
    console.log(`Increase allowance response hash = ${incrAllowRespLW['txhash']}`);

    let executeMsg = {
        provide_native_for_reward: {
            asset:
            {
                info: {
                    native_token: {
                        denom: "uusd"
                    }
                },
                amount: baseUstAmount.toString()
            }

        }
    };
    let tax = await terraClient.utils.calculateTax(new Coin("uusd", baseUstAmount.toString()));
    console.log(`tax = ${tax}`);
    let funds = baseUstAmount + Number(tax.amount);
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

const queryInvestmentReward = async (deploymentDetails) => {
    let qRes = await queryContract(deploymentDetails.proxyContractAddress, {
        get_bonding_details: {
            user_address: marketing_wallet.key.accAddress
        }
    });
    console.log(`bonded reward query ${JSON.stringify(qRes)}`);
}

main()