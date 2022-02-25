use crate::error::ContractError;
use crate::msg::{ExecuteMsg, InstantiateMsg, ProxyCw20HookMsg, QueryMsg};
use crate::state::{
    BondedRewardsDetails, Config, ContractVersion, SubMessageDetails, SubMessageNextAction,
    SubMessageType, BONDED_REWARDS_DETAILS, CONFIG, CONTRACT, SUB_MESSAGE_DETAILS, SUB_REQ_ID,
};
use astroport::asset::{addr_validate_to_lower, Asset, AssetInfo, PairInfo};
use astroport::pair::ExecuteMsg as PairExecuteMsg;
use astroport::pair::QueryMsg::{CumulativePrices, Pair, Pool, ReverseSimulation, Simulation};
use astroport::pair::{
    CumulativePricesResponse, Cw20HookMsg, PoolResponse, ReverseSimulationResponse,
    SimulationResponse,
};

use cosmwasm_std::{
    entry_point, from_binary, to_binary, Addr, BankMsg, Binary, Coin, ContractResult, CosmosMsg,
    Decimal, Deps, DepsMut, Env, MessageInfo, Reply, ReplyOn, Response, StdError, StdResult,
    Storage, SubMsg, Timestamp, Uint128, Uint64, WasmMsg,
};
use cw20::{Cw20ExecuteMsg, Cw20ReceiveMsg};

/// Contract name that is used for migration.
const CONTRACT_NAME: &str = "astroport-proxy";
/// Contract version that is used for migration.
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

const FURY_PROVIDED: bool = true;
const NO_FURY_PROVIDED: bool = false;

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;
    let mut cfg = Config {
        custom_token_address: addr_validate_to_lower(deps.api, msg.custom_token_address.as_str())?,
        pair_discount_rate: msg.pair_discount_rate,
        pair_bonding_period_in_sec: msg.pair_bonding_period_in_sec,
        pair_fury_reward_wallet: addr_validate_to_lower(
            deps.api,
            msg.pair_fury_reward_wallet.as_str(),
        )?,
        native_discount_rate: msg.native_discount_rate,
        native_bonding_period_in_sec: msg.native_bonding_period_in_sec,
        native_investment_reward_wallet: addr_validate_to_lower(
            deps.api,
            msg.native_investment_reward_wallet.as_str(),
        )?,

        authorized_liquidity_provider: addr_validate_to_lower(
            deps.api,
            msg.authorized_liquidity_provider.as_str(),
        )?,
        native_investment_receive_wallet: addr_validate_to_lower(
            deps.api,
            msg.native_investment_receive_wallet.as_str(),
        )?,
        swap_opening_date: Timestamp::from_nanos(msg.swap_opening_date.u64()),
        pool_pair_address: String::default(),
        pair_lp_tokens_holder: addr_validate_to_lower(
            deps.api,
            msg.pair_lp_tokens_holder.as_str(),
        )?,
        liquidity_token: Addr::unchecked(""),
    };
    if let Some(pool_pair_addr) = msg.pool_pair_address {
        cfg.pool_pair_address = pool_pair_addr;
    }
    CONFIG.save(deps.storage, &cfg)?;
    // configure_proxy(deps, env, info, None, msg.swap_opening_date)?;
    Ok(Response::default())
}

/// set_contract_version should be used in instantiate to store the original version, and after a successful
/// migrate to update it
pub fn set_contract_version<T: Into<String>, U: Into<String>>(
    store: &mut dyn Storage,
    name: T,
    version: U,
) -> StdResult<()> {
    let val = ContractVersion {
        contract: name.into(),
        version: version.into(),
    };
    CONTRACT.save(store, &val)
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Configure {
            pool_pair_address,
            liquidity_token,
            swap_opening_date,
        } => configure_proxy(
            deps,
            env,
            info,
            pool_pair_address,
            liquidity_token,
            swap_opening_date,
        ),
        ExecuteMsg::Receive(received_message) => {
            process_received_message(deps, env, info, received_message)
        }
        ExecuteMsg::ProvideLiquidity {
            assets,
            slippage_tolerance,
            auto_stake,
        } => {
            let config = CONFIG.load(deps.storage)?;
            if info.sender != config.authorized_liquidity_provider {
                return Err(ContractError::Unauthorized {});
            }

            let receiver = Some(config.authorized_liquidity_provider.to_string());
            provide_liquidity(
                deps,
                env,
                info,
                assets,
                slippage_tolerance,
                auto_stake,
                receiver,
                SubMessageNextAction::IncreaseAllowance,
            )
        }
        ExecuteMsg::ProvidePairForReward {
            assets,
            slippage_tolerance,
            auto_stake,
        } => {
            let config = CONFIG.load(deps.storage)?;
            let receiver: Option<String>;
            receiver = Some(config.pair_lp_tokens_holder.to_string());
            provide_liquidity(
                deps,
                env,
                info,
                assets,
                slippage_tolerance,
                auto_stake,
                receiver,
                SubMessageNextAction::TransferCustomAssetsFromFundsOwner,
            )
        }
        ExecuteMsg::ProvideNativeForReward {
            asset,
            slippage_tolerance,
            auto_stake,
        } => {
            let config = CONFIG.load(deps.storage)?;
            let assets = [
                Asset {
                    info: AssetInfo::NativeToken {
                        denom: "uusd".to_string(),
                    },
                    amount: asset.amount,
                },
                Asset {
                    info: AssetInfo::Token {
                        contract_addr: config.custom_token_address,
                    },
                    amount: Uint128::from(0u128),
                },
            ];

            let receiver: Option<String>;
            receiver = Some(config.native_investment_receive_wallet.to_string());
            provide_native_liquidity(
                deps,
                env,
                info,
                assets,
                slippage_tolerance,
                auto_stake,
                receiver,
            )
        }
        ExecuteMsg::Swap {
            offer_asset,
            belief_price,
            max_spread,
            to,
        } => {
            offer_asset.info.check(deps.api)?;
            if !offer_asset.is_native_token() {
                return Err(ContractError::Unauthorized {});
            }

            let to_addr = if let Some(to_addr) = to {
                Some(addr_validate_to_lower(deps.api, &to_addr)?)
            } else {
                Some(info.clone().sender)
            };

            swap(
                deps,
                env,
                info.clone(),
                offer_asset,
                belief_price,
                max_spread,
                to_addr,
            )
        }
        ExecuteMsg::RewardClaim {
            receiver,
            withdrawal_amount,
        } => claim_investment_reward(deps, env, info, receiver, withdrawal_amount),
    }
}

fn configure_proxy(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    pool_pair_address: Option<String>,
    liquidity_token: Option<String>,
    swap_opening_date: Uint64,
) -> Result<Response, ContractError> {
    // let sender_addr = info.sender.clone();
    // let contract_address = env.clone().contract.address;
    // let balances = deps.querier.query_all_balances(contract_address.clone().into_string())?;
    // if true {
    //     return Err(ContractError::Std(StdError::generic_err(format!(
    //         "in process_received_message!!! with funds = {:?} and contract balances = {:?} for address {:?} and sender = {:?}",
    //         info.funds, balances, contract_address, sender_addr
    //     ))));
    // }

    let mut config = CONFIG.load(deps.storage)?;
    if let Some(pool_pair_addr) = pool_pair_address {
        config.pool_pair_address = pool_pair_addr;
    }
    if let Some(liquidity_token) = liquidity_token {
        config.liquidity_token = addr_validate_to_lower(deps.api, &liquidity_token)?;
    }
    config.swap_opening_date = Timestamp::from_nanos(swap_opening_date.u64());
    CONFIG.save(deps.storage, &config)?;
    Ok(Response::default())
}

fn process_received_message(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    received_message: Cw20ReceiveMsg,
) -> Result<Response, ContractError> {
    // let config: Config = CONFIG.load(deps.storage)?;
    // let sender_addr = info.sender.clone();
    // let contract_address = env.clone().contract.address;
    // let balances = deps.querier.query_all_balances(contract_address.clone().into_string())?;
    // let sender_balances = deps.querier.query_all_balances(sender_addr.clone().into_string())?;
    // if true {
    //     return Err(ContractError::Std(StdError::generic_err(format!(
    //         "in process_received_message!!! with funds = {:?} and contract balances = {:?} for address {:?} and sender_balance = {:?} for sender = {:?}",
    //         info.funds, balances, contract_address, sender_balances, sender_addr,
    //     ))));
    // }
    match from_binary(&received_message.msg) {
        Ok(ProxyCw20HookMsg::Swap {
            belief_price,
            max_spread,
            to,
        }) => {
            let to_address: Option<String>;
            match to {
                Some(to_addr) => to_address = Some(to_addr),
                None => to_address = Some(received_message.sender),
            }
            let swap_msg_to_send = ProxyCw20HookMsg::Swap {
                belief_price: belief_price,
                max_spread: max_spread,
                to: to_address,
            };
            forward_swap_to_astro(deps, info, swap_msg_to_send, received_message.amount)
        }
        Ok(ProxyCw20HookMsg::WithdrawLiquidity {}) => {
            withdraw_liquidity(deps, env, info, received_message)
        }
        // Ok(ProxyCw20HookMsg::ProvideLiquidity {
        //     assets,
        //     slippage_tolerance,
        //     auto_stake,
        //     receiver,
        // }) => provide_liquidity(
        //     deps,
        //     env,
        //     info,
        //     assets,
        //     slippage_tolerance,
        //     auto_stake,
        //     receiver,
        //     SubMessageNextAction::IncreaseAllowance,
        // ),
        Err(err) => Err(ContractError::Std(err)),
    }
    // Ok(Response::default())
}

pub fn incr_allow_for_provide_liquidity(
    deps: DepsMut,
    env: Env,
    assets: [Asset; 2],
    slippage_tolerance: Option<Decimal>,
    auto_stake: Option<bool>,
    receiver: Option<String>,
    funds: Vec<Coin>,
    user_address: String,
    is_fury_provided: bool,
) -> Result<Response, ContractError> {
    let mut resp = Response::new();
    let config: Config = CONFIG.load(deps.storage)?;

    // Get the amount of Fury tokens to be specified in transfer_from and increase_allowance
    let mut amount = Uint128::zero();
    if !assets[0].info.is_native_token() {
        amount = assets[0].amount;
    } else if !assets[1].info.is_native_token() {
        amount = assets[1].amount;
    }

    // Prepare submessage for Increase Allowance
    let increase_allowance_msg = Cw20ExecuteMsg::IncreaseAllowance {
        spender: config.pool_pair_address,
        amount: amount,
        expires: None,
    };
    let exec_incr_allow = WasmMsg::Execute {
        contract_addr: config.custom_token_address.to_string(),
        msg: to_binary(&increase_allowance_msg).unwrap(),
        funds: vec![],
    };
    let mut send_incr_allow: SubMsg = SubMsg::new(exec_incr_allow);
    let mut sub_req_id = 1;
    if let Some(mut req_id) = SUB_REQ_ID.may_load(deps.storage)? {
        req_id += 1;
        SUB_REQ_ID.save(deps.storage, &req_id)?;
        sub_req_id = req_id;
    } else {
        SUB_REQ_ID.save(deps.storage, &sub_req_id)?;
    }
    send_incr_allow.reply_on = ReplyOn::Always;
    send_incr_allow.id = sub_req_id;

    resp = resp.add_submessage(send_incr_allow);

    let pl_msg = PairExecuteMsg::ProvideLiquidity {
        assets: assets,
        slippage_tolerance: slippage_tolerance,
        auto_stake: auto_stake,
        receiver: receiver,
    };

    // let data_msg = format!("{:?}", pl_msg).into_bytes();

    // Save the submessage_payload
    SUB_MESSAGE_DETAILS.save(
        deps.storage,
        sub_req_id.to_string(),
        &SubMessageDetails {
            sub_req_id: sub_req_id.to_string(),
            request_type: SubMessageType::ProvideLiquiditySubMsg,
            next_action: SubMessageNextAction::ProvideLiquidity,
            sub_message_payload: to_binary(&pl_msg)?,
            funds: funds,
            user_address: user_address,
            is_fury_provided: is_fury_provided,
        },
    )?;

    Ok(resp.add_attribute(
        "action",
        "Increase Allowance for proxy contract to Provide Liquidity",
    ))
}

pub fn forward_provide_liquidity_to_astro(
    deps: DepsMut,
    env: Env,
    assets: [Asset; 2],
    slippage_tolerance: Option<Decimal>,
    auto_stake: Option<bool>,
    receiver: Option<String>,
    funds: Vec<Coin>,
) -> Result<Response, ContractError> {
    let config: Config = CONFIG.load(deps.storage)?;

    let mut funds_to_pass: Vec<Coin> = Vec::new();
    for fund in funds {
        let asset = Asset {
            amount: fund.amount,
            info: AssetInfo::NativeToken {
                denom: fund.denom.clone(),
            },
        };
        let c = Coin {
            denom: fund.denom,
            amount: fund
                .amount
                .checked_sub(asset.compute_tax(&deps.querier)?)
                .unwrap(),
        };
        funds_to_pass.push(c);
    }

    let pl_msg = PairExecuteMsg::ProvideLiquidity {
        assets,
        slippage_tolerance,
        auto_stake,
        receiver,
    };
    let exec = WasmMsg::Execute {
        contract_addr: config.pool_pair_address.to_string(),
        msg: to_binary(&pl_msg).unwrap(),
        funds: funds_to_pass,
    };
    let mut send: SubMsg = SubMsg::new(exec);
    let mut sub_req_id = 1;
    if let Some(mut req_id) = SUB_REQ_ID.may_load(deps.storage)? {
        req_id += 1;
        SUB_REQ_ID.save(deps.storage, &req_id)?;
        sub_req_id = req_id;
    } else {
        SUB_REQ_ID.save(deps.storage, &sub_req_id)?;
    }
    send.id = sub_req_id;
    send.reply_on = ReplyOn::Always;

    let mut resp = Response::new();
    resp = resp.add_submessage(send);
    let data_msg = format!("provide liquidity details {:?}", pl_msg).into_bytes();
    Ok(resp
        .add_attribute("action", "Sending provide liquidity message")
        .set_data(data_msg))
}

pub fn forward_swap_to_astro(
    deps: DepsMut,
    info: MessageInfo,
    received_message: ProxyCw20HookMsg,
    amount: Uint128,
) -> Result<Response, ContractError> {
    let config: Config = CONFIG.load(deps.storage)?;
    let send_msg = Cw20ExecuteMsg::Send {
        contract: config.pool_pair_address,
        amount: amount,
        msg: to_binary(&received_message)?,
    };
    let exec = WasmMsg::Execute {
        contract_addr: config.custom_token_address.into_string(),
        msg: to_binary(&send_msg).unwrap(),
        funds: info.funds,
    };
    let mut send: SubMsg = SubMsg::new(exec);
    let mut sub_req_id = 1;
    if let Some(mut req_id) = SUB_REQ_ID.may_load(deps.storage)? {
        req_id += 1;
        SUB_REQ_ID.save(deps.storage, &req_id)?;
        sub_req_id = req_id;
    } else {
        SUB_REQ_ID.save(deps.storage, &sub_req_id)?;
    }

    send.id = sub_req_id;
    send.reply_on = ReplyOn::Always;

    let mut resp = Response::new();
    resp = resp.add_submessage(send);
    Ok(resp.add_attribute("action", "Forwarding swap message to pool pair address"))
}

pub fn provide_native_liquidity(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    assets: [Asset; 2],
    slippage_tolerance: Option<Decimal>,
    auto_stake: Option<bool>,
    receiver: Option<String>,
) -> Result<Response, ContractError> {
    let user_address = info.sender.into_string();
    transfer_custom_assets_from_funds_owner_to_proxy(
        deps,
        env,
        assets,
        slippage_tolerance,
        auto_stake,
        receiver,
        info.funds,
        user_address,
        NO_FURY_PROVIDED,
    )
}

pub fn transfer_native_assets_to_native_investment_receive_wallet(
    deps: DepsMut,
    receiver: Option<String>,
    funds: Vec<Coin>,
) -> Result<Response, ContractError> {
    let mut funds_to_pass: Vec<Coin> = Vec::new();
    for fund in funds {
        let asset = Asset {
            amount: fund.amount,
            info: AssetInfo::NativeToken {
                denom: fund.denom.clone(),
            },
        };
        let c = Coin {
            denom: fund.denom,
            amount: fund
                .amount
                .checked_sub(asset.compute_tax(&deps.querier)?)
                .unwrap(),
        };
        funds_to_pass.push(c);
    }

    let resp = Response::new();
    Ok(resp.add_message(CosmosMsg::Bank(BankMsg::Send {
        to_address: receiver.unwrap(),
        amount: funds_to_pass,
    })))
}

pub fn transfer_custom_assets_from_funds_owner_to_proxy(
    deps: DepsMut,
    env: Env,
    assets: [Asset; 2],
    slippage_tolerance: Option<Decimal>,
    auto_stake: Option<bool>,
    receiver: Option<String>,
    funds: Vec<Coin>,
    user_address: String,
    is_fury_provided: bool,
) -> Result<Response, ContractError> {
    let mut fury_amount_provided = Uint128::zero();
    let mut ust_amount_provided = Uint128::zero();
    if is_fury_provided {
        if !assets[0].info.is_native_token() {
            fury_amount_provided = assets[0].amount;
            ust_amount_provided = assets[1].amount;
        } else if !assets[1].info.is_native_token() {
            fury_amount_provided = assets[1].amount;
            ust_amount_provided = assets[0].amount;
        }
    } else {
        if !assets[0].info.is_native_token() {
            ust_amount_provided = assets[1].amount;
        } else if !assets[1].info.is_native_token() {
            ust_amount_provided = assets[0].amount;
        }
    }

    let mut resp = Response::new();
    let config = CONFIG.load(deps.storage)?;
    let pool_rsp: PoolResponse = deps
        .querier
        .query_wasm_smart(config.pool_pair_address, &Pool {})?;
    let mut fury_equiv_for_ust;
    if pool_rsp.assets[0].info.is_native_token() {
        fury_equiv_for_ust = ust_amount_provided
            .checked_mul(pool_rsp.assets[1].amount)
            .unwrap_or_default()
            .checked_div(pool_rsp.assets[0].amount)
            .unwrap_or_default();
    } else {
        fury_equiv_for_ust = ust_amount_provided
            .checked_mul(pool_rsp.assets[0].amount)
            .unwrap_or_default()
            .checked_div(pool_rsp.assets[1].amount)
            .unwrap_or_default();
    }
    let fury_pre_discount;
    let funds_owner;
    let bonding_period;
    let mut discounted_rate = 10000u16; // 100 percent
    if is_fury_provided {
        if fury_equiv_for_ust > fury_amount_provided {
            fury_equiv_for_ust = fury_amount_provided;
        }
        fury_pre_discount = Uint128::from(2u128) * fury_equiv_for_ust;
        discounted_rate -= config.pair_discount_rate;
        funds_owner = config.pair_fury_reward_wallet.to_string();
        bonding_period = config.pair_bonding_period_in_sec;
    } else {
        fury_pre_discount = fury_equiv_for_ust;
        discounted_rate -= config.native_discount_rate;
        funds_owner = config.native_investment_reward_wallet.to_string();
        bonding_period = config.native_bonding_period_in_sec;
    }
    let total_fury_amount = fury_pre_discount
        .checked_mul(Uint128::from(10000u128))
        .unwrap_or_default()
        .checked_div(Uint128::from(discounted_rate))
        .unwrap_or_default();

    // Get the existing bonded_rewards_details for this user
    let mut bonded_rewards_details = Vec::new();
    let all_bonded_rewards_details =
        BONDED_REWARDS_DETAILS.may_load(deps.storage, user_address.to_string())?;
    match all_bonded_rewards_details {
        Some(some_bonded_rewards_details) => {
            bonded_rewards_details = some_bonded_rewards_details;
        }
        None => {}
    }
    let mut bonding_start_timestamp = Timestamp::from_seconds(0u64);
    if config.swap_opening_date < env.block.time {
        bonding_start_timestamp = env.block.time;
    }
    bonded_rewards_details.push(BondedRewardsDetails {
        user_address: user_address.to_string(),
        bonded_amount: total_fury_amount,
        bonding_period: bonding_period,
        bonding_start_timestamp: bonding_start_timestamp,
    });
    BONDED_REWARDS_DETAILS.save(
        deps.storage,
        user_address.to_string(),
        &bonded_rewards_details,
    )?;

    // Prepare submessage for Execute transfer_from funds_owner to proxy contract
    let transfer_from_msg = Cw20ExecuteMsg::TransferFrom {
        owner: funds_owner.clone(),
        recipient: env.contract.address.into_string(),
        amount: total_fury_amount,
    };
    let exec_transfer_from = WasmMsg::Execute {
        contract_addr: config.custom_token_address.to_string(),
        msg: to_binary(&transfer_from_msg).unwrap(),
        funds: vec![],
    };
    let mut send_transfer_from: SubMsg = SubMsg::new(exec_transfer_from);
    let mut sub_req_id = 1;
    if let Some(mut req_id) = SUB_REQ_ID.may_load(deps.storage)? {
        req_id += 1;
        SUB_REQ_ID.save(deps.storage, &req_id)?;
        sub_req_id = req_id;
    } else {
        SUB_REQ_ID.save(deps.storage, &sub_req_id)?;
    }
    send_transfer_from.reply_on = ReplyOn::Always;
    send_transfer_from.id = sub_req_id;
    resp = resp.add_submessage(send_transfer_from);
    let pl_msg = PairExecuteMsg::ProvideLiquidity {
        assets: assets,
        slippage_tolerance: slippage_tolerance,
        auto_stake: auto_stake,
        receiver: receiver,
    };

    // Save the submessage_payload
    if is_fury_provided {
        SUB_MESSAGE_DETAILS.save(
            deps.storage,
            sub_req_id.to_string(),
            &SubMessageDetails {
                sub_req_id: sub_req_id.to_string(),
                request_type: SubMessageType::ProvideLiquiditySubMsg,
                next_action: SubMessageNextAction::IncreaseAllowance,
                sub_message_payload: to_binary(&pl_msg)?,
                funds: funds,
                user_address: user_address,
                is_fury_provided: is_fury_provided,
            },
        )?;
    } else {
        // Save the submessage_payload
        SUB_MESSAGE_DETAILS.save(
            deps.storage,
            sub_req_id.to_string(),
            &SubMessageDetails {
                sub_req_id: sub_req_id.to_string(),
                request_type: SubMessageType::ProvideLiquiditySubMsg,
                next_action: SubMessageNextAction::TransferToNativeInvestmentReceiveWallet,
                sub_message_payload: to_binary(&pl_msg)?,
                funds: funds,
                user_address: user_address,
                is_fury_provided: is_fury_provided,
            },
        )?;
    }
    Ok(resp.add_attribute(
        "action",
        "Transferring fury from treasury funds owner to proxy",
    ))
}

pub fn provide_liquidity(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    assets: [Asset; 2],
    slippage_tolerance: Option<Decimal>,
    auto_stake: Option<bool>,
    receiver: Option<String>,
    next_action: SubMessageNextAction,
) -> Result<Response, ContractError> {
    let mut resp = Response::new();
    let config: Config = CONFIG.load(deps.storage)?;
    // Get the amount of Fury tokens to be specified in transfer_from and increase_allowance
    let mut amount = Uint128::zero();
    if !assets[0].info.is_native_token() {
        amount = assets[0].amount;
    } else if !assets[1].info.is_native_token() {
        amount = assets[1].amount;
    }

    let user_address = info.sender.into_string();

    // Prepare submessage for Execute transfer_from user wallet to proxy contract
    let transfer_from_msg = Cw20ExecuteMsg::TransferFrom {
        owner: user_address.clone(),
        recipient: env.contract.address.into_string(),
        amount: amount,
    };
    let exec_transfer_from = WasmMsg::Execute {
        contract_addr: config.custom_token_address.to_string(),
        msg: to_binary(&transfer_from_msg).unwrap(),
        funds: vec![],
    };
    let mut send_transfer_from: SubMsg = SubMsg::new(exec_transfer_from);
    let mut sub_req_id = 1;
    if let Some(mut req_id) = SUB_REQ_ID.may_load(deps.storage)? {
        req_id += 1;
        SUB_REQ_ID.save(deps.storage, &req_id)?;
        sub_req_id = req_id;
    } else {
        SUB_REQ_ID.save(deps.storage, &sub_req_id)?;
    }
    send_transfer_from.reply_on = ReplyOn::Always;
    send_transfer_from.id = sub_req_id;
    resp = resp.add_submessage(send_transfer_from);
    let pl_msg = PairExecuteMsg::ProvideLiquidity {
        assets: assets,
        slippage_tolerance: slippage_tolerance,
        auto_stake: auto_stake,
        receiver: receiver,
    };

    // Save the submessage_payload
    SUB_MESSAGE_DETAILS.save(
        deps.storage,
        sub_req_id.to_string(),
        &SubMessageDetails {
            sub_req_id: sub_req_id.to_string(),
            request_type: SubMessageType::ProvideLiquiditySubMsg,
            next_action: next_action,
            sub_message_payload: to_binary(&pl_msg)?,
            funds: info.funds,
            user_address: user_address.clone(),
            is_fury_provided: FURY_PROVIDED,
        },
    )?;

    Ok(resp.add_attribute("action", "Transferring tokens for Provide Liquidity"))
}

pub fn withdraw_liquidity(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    received_message: Cw20ReceiveMsg,
) -> Result<Response, ContractError> {
    let config: Config = CONFIG.load(deps.storage)?;

    if info.sender != config.liquidity_token {
        return Err(ContractError::Unauthorized {});
    }
    let wl_msg = Cw20ExecuteMsg::Send {
        contract: config.pool_pair_address.to_string(),
        amount: received_message.amount,
        msg: received_message.msg,
    };
    let exec = WasmMsg::Execute {
        contract_addr: config.liquidity_token.to_string(),
        msg: to_binary(&wl_msg).unwrap(),
        funds: info.funds,
    };

    let mut send: SubMsg = SubMsg::new(exec);
    let mut resp = Response::new();
    let data_msg = format!("Withdraw {:?}", wl_msg).into_bytes();
    Ok(resp
        .add_submessage(send)
        .add_attribute("action", "Forwarding withdraw message to lptoken address")
        .set_data(data_msg))

    // Err(ContractError::Std(StdError::generic_err(format!(
    //     "Nitin was here in sender = {:?} amount = {:?}",
    //     sender, amount
    // ))))
}

fn claim_investment_reward(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    receiver: String,
    withdrawal_amount: Uint128,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    let receiver_addr = deps.api.addr_validate(&receiver)?;
    //Check if withdrawer is same as invoker
    if receiver_addr != info.sender {
        return Err(ContractError::Unauthorized {});
    }
    if env.block.time < config.swap_opening_date {
        return Err(ContractError::Std(StdError::generic_err(format!(
            "Swap Opening not reached {:?}",
            config.swap_opening_date
        ))));
    }

    let FAR_IN_FUTURE = env.block.time.plus_seconds(2000 * 24 * 60 * 60).seconds();

    let mut action = "claim_investment_reward".to_string();
    let mut unbonded_amount = Uint128::zero();
    let mut amount_remaining = withdrawal_amount.clone();

    // parse bonding to check maturity and sort with descending order of timestamp
    let mut bonds = Vec::new();
    let mut updated_bonds = Vec::new();
    let mut earliest = FAR_IN_FUTURE;
    let mut earliestAmount = Uint128::zero();

    let mut all_bonds = BONDED_REWARDS_DETAILS.may_load(deps.storage, receiver.clone())?;
    match all_bonds {
        Some(some_bonds) => {
            bonds = some_bonds;
            let mut updated_bond;
            for bond in bonds {
                println!(
                    "receiver {:?} timestamp  {:?} duration  {:?} amount {:?}",
                    receiver_addr,
                    bond.bonding_start_timestamp,
                    bond.bonding_period,
                    bond.bonded_amount
                );

                updated_bond = bond.clone();
                let _bond_timestamp;
                if bond.bonding_start_timestamp.seconds() == Timestamp::from_seconds(0u64).seconds()
                {
                    _bond_timestamp = config.swap_opening_date;
                } else {
                    _bond_timestamp = bond.bonding_start_timestamp;
                }
                if _bond_timestamp.plus_seconds(bond.bonding_period).seconds() < earliest {
                    earliest = _bond_timestamp.plus_seconds(bond.bonding_period).seconds();
                    earliestAmount = bond.bonded_amount.clone();
                }
                if _bond_timestamp.plus_seconds(bond.bonding_period).seconds()
                    < env.block.time.seconds()
                {
                    if amount_remaining > Uint128::zero() {
                        if bond.bonded_amount > amount_remaining {
                            unbonded_amount = amount_remaining;
                            updated_bond.bonded_amount -= amount_remaining;
                            amount_remaining = Uint128::zero();
                            updated_bonds.push(updated_bond);
                        } else {
                            unbonded_amount += bond.bonded_amount;
                            amount_remaining -= bond.bonded_amount;
                        }
                    } else {
                        updated_bonds.push(updated_bond);
                    }
                } else {
                    updated_bonds.push(updated_bond);
                }
            }
        }
        None => {}
    }

    if unbonded_amount == Uint128::zero() {
        let message;
        if earliest < FAR_IN_FUTURE {
            message = format!(
                "Earliest Withdrawal Amount {:?} at {:?}",
                earliestAmount, earliest
            );
        } else {
            message = format!("No Bonded Rewards");
        }
        return Err(ContractError::Std(StdError::generic_err(message)));
    } else {
        if amount_remaining > Uint128::zero() {
            return Err(ContractError::Std(StdError::generic_err(format!(
                "Withdraw Amount requested is more than Claimable {:?}",
                unbonded_amount
            ))));
        }
    }

    BONDED_REWARDS_DETAILS.save(deps.storage, receiver.clone(), &updated_bonds)?;

    let mut rsp = Response::new();

    let transfer_msg = Cw20ExecuteMsg::Transfer {
        recipient: receiver,
        amount: withdrawal_amount,
    };
    let exec = WasmMsg::Execute {
        contract_addr: config.custom_token_address.to_string(),
        msg: to_binary(&transfer_msg).unwrap(),
        funds: vec![
        // Coin {
        //     denom: token_info.name.to_string(),
        //     amount: price,
        // },
        ],
    };
    let send: SubMsg = SubMsg::new(exec);
    let data_msg = format!("Amount {} transferred", withdrawal_amount).into_bytes();

    rsp = rsp
        .add_submessage(send)
        .add_attribute("action", action)
        .add_attribute("withdrawn", withdrawal_amount.clone().to_string())
        .set_data(data_msg);
    return Ok(rsp);
}

#[allow(clippy::too_many_arguments)]
pub fn swap(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    offer_asset: Asset,
    belief_price: Option<Decimal>,
    max_spread: Option<Decimal>,
    to: Option<Addr>,
) -> Result<Response, ContractError> {
    let config: Config = CONFIG.load(deps.storage)?;
    // Check if the swap_enable_date is passed
    if config.swap_opening_date.nanos() > env.block.time.nanos() {
        //return error
        return Err(ContractError::Std(StdError::generic_err(format!(
            "Swap is not enabled yet!!!",
        ))));
    }
    // Swap is enabled so proceed
    let to_address: Option<String>;
    match to {
        Some(to_addr) => to_address = Some(to_addr.into_string()),
        None => to_address = Some(info.sender.clone().into_string()),
    }
    let mut funds_to_send = vec![];
    //Check if assets provided are native tokens
    offer_asset.info.check(deps.api)?;
    if offer_asset.is_native_token() {
        if let AssetInfo::NativeToken { denom, .. } = &offer_asset.info {
            funds_to_send = vec![Coin {
                denom: denom.to_string(),
                amount: offer_asset.amount,
            }];
        }
    }
    let swap_msg = PairExecuteMsg::Swap {
        offer_asset: offer_asset,
        belief_price: belief_price,
        max_spread: max_spread,
        to: to_address,
    };
    let exec = WasmMsg::Execute {
        contract_addr: config.pool_pair_address.to_string(),
        msg: to_binary(&swap_msg).unwrap(),
        funds: funds_to_send,
    };
    let mut send: SubMsg = SubMsg::new(exec);
    let mut sub_req_id = 1;
    if let Some(mut req_id) = SUB_REQ_ID.may_load(deps.storage)? {
        req_id += 1;
        SUB_REQ_ID.save(deps.storage, &req_id)?;
        sub_req_id = req_id;
    } else {
        SUB_REQ_ID.save(deps.storage, &sub_req_id)?;
    }
    send.id = sub_req_id;
    send.reply_on = ReplyOn::Always;

    let mut resp = Response::new();
    resp = resp.add_submessage(send);
    let data_msg = format!("Swapping {:?}", swap_msg).into_bytes();
    Ok(resp
        .add_attribute("action", "Sending swap message")
        .set_data(data_msg))
}

pub fn set_swap_opening_date(
    deps: DepsMut,
    _env: Env,
    swap_opening_date: Timestamp,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    config.swap_opening_date = swap_opening_date;
    CONFIG.save(deps.storage, &config)?;
    Ok(Response::default())
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn reply(deps: DepsMut, env: Env, msg: Reply) -> Result<Response, ContractError> {
    let result = msg.result;
    match result {
        ContractResult::Ok(sub_msg) => {
            let sub_msg_id = msg.id;
            let sub_message_details =
                SUB_MESSAGE_DETAILS.may_load(deps.storage, sub_msg_id.to_string())?;
            match sub_message_details {
                Some(smd) => {
                    match smd.request_type {
                        SubMessageType::TransferFromSubMsg => {
                            // Remove the saved submessage from storage
                            SUB_MESSAGE_DETAILS.remove(deps.storage, msg.id.to_string());
                        }
                        SubMessageType::IncreaseAlowanceSubMsg => {
                            // Remove the saved submessage from storage
                            SUB_MESSAGE_DETAILS.remove(deps.storage, msg.id.to_string());
                        }
                        SubMessageType::ProvideLiquiditySubMsg => {
                            // Remove the saved submessage from storage
                            SUB_MESSAGE_DETAILS.remove(deps.storage, msg.id.to_string());
                            match from_binary(&smd.sub_message_payload).unwrap() {
                                PairExecuteMsg::ProvideLiquidity {
                                    assets,
                                    slippage_tolerance,
                                    auto_stake,
                                    receiver,
                                } => {
                                    if smd.next_action
                                    == SubMessageNextAction::TransferCustomAssetsFromFundsOwner
                                {
                                    return transfer_custom_assets_from_funds_owner_to_proxy(
                                        deps,
                                        env,
                                        assets,
                                        slippage_tolerance,
                                        auto_stake,
                                        receiver,
                                        smd.funds,
                                        smd.user_address,
                                        smd.is_fury_provided,
                                    );
                                } else if smd.next_action == SubMessageNextAction::TransferToNativeInvestmentReceiveWallet{
                                    return transfer_native_assets_to_native_investment_receive_wallet(
                                        deps,
                                        receiver,
                                        smd.funds,
                                    );
                                } else if smd.next_action == SubMessageNextAction::IncreaseAllowance
                                {
                                    return incr_allow_for_provide_liquidity(
                                        deps,
                                        env,
                                        assets,
                                        slippage_tolerance,
                                        auto_stake,
                                        receiver,
                                        smd.funds,
                                        smd.user_address,
                                        smd.is_fury_provided,
                                    );
                                } else if smd.next_action == SubMessageNextAction::ProvideLiquidity
                                {
                                    return forward_provide_liquidity_to_astro(
                                        deps,
                                        env,
                                        assets,
                                        slippage_tolerance,
                                        auto_stake,
                                        receiver,
                                        smd.funds,
                                    );
                                }
                                }
                                _ => {
                                    return Err(ContractError::Std(StdError::generic_err(
                                        format!("Should never reach here!!!",),
                                    )));
                                }
                            }
                        }
                    }
                }
                None => {}
            }
            // For all fall-through messages respond with success
            let mut resp = Response::new();
            for event in sub_msg.events {
                resp = resp.add_attributes(event.attributes);
            }
            match sub_msg.data {
                Some(d) => resp = resp.set_data(d),
                None => {}
            }
            return Ok(resp);
        }
        ContractResult::Err(error) => {
            return Err(ContractError::Std(StdError::generic_err(format!(
                "Received error: {:?}",
                error
            ))));
        }
    }
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Configuration {} => to_binary(&query_configuration(deps)?),
        QueryMsg::Pair {} => to_binary(&query_pair(deps)?),
        QueryMsg::Pool {} => to_binary(&query_pool(deps)?),
        QueryMsg::Simulation { offer_asset } => to_binary(&query_simulation(deps, offer_asset)?),
        QueryMsg::ReverseSimulation { ask_asset } => {
            to_binary(&query_reverse_simulation(deps, ask_asset)?)
        }
        QueryMsg::CumulativePrices {} => to_binary(&query_cumulative_prices(deps)?),
        QueryMsg::GetSwapOpeningDate {} => to_binary(&query_swap_opening_date(deps)?),
        QueryMsg::GetBondingDetails { user_address } => {
            to_binary(&query_bonding_details(deps, user_address)?)
        }
    }
}

fn query_configuration(deps: Deps) -> StdResult<Config> {
    let config: Config = CONFIG.load(deps.storage)?;
    Ok(config)
}

fn query_pool(deps: Deps) -> StdResult<PoolResponse> {
    let config: Config = CONFIG.load(deps.storage)?;
    deps.querier
        .query_wasm_smart(config.pool_pair_address, &Pool {})
}

fn query_pair(deps: Deps) -> StdResult<PairInfo> {
    let config: Config = CONFIG.load(deps.storage)?;
    deps.querier
        .query_wasm_smart(config.pool_pair_address, &Pair {})
}

fn query_simulation(deps: Deps, offer_asset: Asset) -> StdResult<SimulationResponse> {
    let config: Config = CONFIG.load(deps.storage)?;
    deps.querier.query_wasm_smart(
        config.pool_pair_address,
        &Simulation {
            offer_asset: offer_asset,
        },
    )
}

fn query_reverse_simulation(deps: Deps, ask_asset: Asset) -> StdResult<ReverseSimulationResponse> {
    let config: Config = CONFIG.load(deps.storage)?;
    deps.querier.query_wasm_smart(
        config.pool_pair_address,
        &ReverseSimulation {
            ask_asset: ask_asset,
        },
    )
}

fn query_cumulative_prices(deps: Deps) -> StdResult<CumulativePricesResponse> {
    let config: Config = CONFIG.load(deps.storage)?;
    deps.querier
        .query_wasm_smart(config.pool_pair_address, &CumulativePrices {})
}

fn query_swap_opening_date(deps: Deps) -> StdResult<Timestamp> {
    let config: Config = CONFIG.load(deps.storage)?;
    Ok(config.swap_opening_date)
}

fn query_bonding_details(
    deps: Deps,
    user_address: String,
) -> StdResult<Option<Vec<BondedRewardsDetails>>> {
    let bonding_details = BONDED_REWARDS_DETAILS.may_load(deps.storage, user_address.clone())?;
    Ok(bonding_details)
}
