use astroport::asset::Asset;
use cosmwasm_std::{Decimal, Timestamp, Uint64};
use cw20::Cw20ReceiveMsg;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, JsonSchema, Debug, Clone, PartialEq)]
pub struct InstantiateMsg {
    pub admin_address: String,
    /// contract address of Fury token
    pub custom_token_address: String,

    /// discount_rate when fury and UST are both provided
    pub pair_discount_rate: u16,
    /// bonding period when fury and UST are both provided
    pub pair_bonding_period_in_days: u16,
    /// fury reward provider when fury and UST are both provided
    pub pair_fury_provider: String,

    /// discount_rate when only UST are both provided
    pub native_discount_rate: u16,
    /// bonding period when only UST provided
    pub native_bonding_period_in_days: u16,
    /// fury reward provider when only UST provided
    pub native_fury_provider: String,

    /// This address has the authority to pump in liquidity
    /// The LP tokens for this address will be returned to this address
    pub authorized_liquidity_provider: String,
    /// The LP tokens for all liquidity providers except
    /// authorised_liquidity_provider will be stored to this address
    pub default_lp_tokens_holder: String,
    ///Time in nano seconds since EPOC when the swapping will be enabled
    pub swap_opening_date: Uint64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    Configure {
        /// Administreator address of astroport
        admin_address: Option<String>,
        /// Pool pair contract address of astroport
        pool_pair_address: Option<String>,
        /// contract address of Liquidity token
        liquidity_token: Option<String>,
        ///Time in nano seconds since EPOC when the swapping will be enabled
        swap_opening_date: Option<Uint64>,
    },
    /// ## Description
    /// Receives a message of type [`Cw20ReceiveMsg`]
    Receive(Cw20ReceiveMsg),
    /// ProvidePairForReward a user provides pair liquidity and gets fury rewards
    ProvidePairForReward {
        /// the type of asset available in [`Asset`]
        assets: [Asset; 2],
        /// the slippage tolerance for sets the maximum percent of price movement
        slippage_tolerance: Option<Decimal>,
        /// Determines whether an autostake will be performed on the generator
        auto_stake: Option<bool>,
    },
    /// ProvideNativeForReward a user provides native liquidity and gets fury rewards
    ProvideNativeForReward {
        /// the type of asset available in [`Asset`]
        asset: Asset,
        /// the slippage tolerance for sets the maximum percent of price movement
        slippage_tolerance: Option<Decimal>,
        /// Determines whether an autostake will be performed on the generator
        auto_stake: Option<bool>,
    },
    /// ProvideLiquidity a user provides pool liquidity and gets lp_tokens
    ProvideLiquidity {
        /// the type of asset available in [`Asset`]
        assets: [Asset; 2],
        /// the slippage tolerance for sets the maximum percent of price movement
        slippage_tolerance: Option<Decimal>,
        /// Determines whether an autostake will be performed on the generator
        auto_stake: Option<bool>,
        /// the receiver of provide liquidity
        receiver: Option<String>,
    },
    /// Swap an offer asset to the other
    Swap {
        offer_asset: Asset,
        belief_price: Option<Decimal>,
        max_spread: Option<Decimal>,
        to: Option<String>,
    },
    SetSwapOpeningDate {
        swap_opening_date: Timestamp,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    Configuration {},
    Pool {},
    Pair {},
    /// Returns information about the simulation of the swap in a [`SimulationResponse`] object.
    Simulation {
        offer_asset: Asset,
    },
    /// Returns information about the reverse simulation in a [`ReverseSimulationResponse`] object.
    ReverseSimulation {
        ask_asset: Asset,
    },
    /// Returns information about the cumulative prices in a [`CumulativePricesResponse`] object
    CumulativePrices {},
    GetSwapOpeningDate {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ProxyCw20HookMsg {
    // ProvideLiquidity {
    //     /// the type of asset available in [`Asset`]
    //     assets: [Asset; 2],
    //     /// the slippage tolerance for sets the maximum percent of price movement
    //     slippage_tolerance: Option<Decimal>,
    //     /// Determines whether an autostake will be performed on the generator
    //     auto_stake: Option<bool>,
    //     /// the receiver of provide liquidity
    //     receiver: Option<String>,
    // },
    /// Sell a given amount of asset
    Swap {
        belief_price: Option<Decimal>,
        max_spread: Option<Decimal>,
        to: Option<String>,
    },
    /// Withdrawing liquidity from the pool
    WithdrawLiquidity {},
}
