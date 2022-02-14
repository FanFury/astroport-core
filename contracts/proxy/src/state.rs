use cosmwasm_std::{Binary, Coin, Timestamp, Addr};
use cw_storage_plus::{Bound, Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub admin_address: Addr,
    pub pool_pair_address: Addr,
    pub custom_token_address: Addr,
    pub liquidity_token: Addr,
    pub authorized_liquidity_provider: Addr,
    pub swap_opening_date: Timestamp,
}
// put the length bytes at the first for compatibility with legacy singleton store
pub const CONFIG: Item<Config> = Item::new("\u{0}\u{6}config");

pub const CONTRACT: Item<ContractVersion> = Item::new("contract_info");

#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
pub struct ContractVersion {
    /// contract is the crate name of the implementing contract, eg. `crate:cw20-base`
    /// we will use other prefixes for other languages, and their standard global namespacing
    pub contract: String,
    /// version is any string that this implementation knows. It may be simple counter "1", "2".
    /// or semantic version on release tags "v0.7.0", or some custom feature flag list.
    /// the only code that needs to understand the version parsing is code that knows how to
    /// migrate from the given contract (and is tied to it's implementation somehow)
    pub version: String,
}

/// This is used for saving pending request details
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SubMessageType {
    TransferFromSubMsg,
    IncreaseAlowanceSubMsg,
    ProvideLiquiditySubMsg,
}

/// This is used for saving pending request details
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SubMessageNextAction {
    TransferNativeAssets,
    TransferCustomAssets,
    IncreaseAllowance,
    ProvideLiquidity,
}

/// This is used for saving pending request details
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, Debug)]
#[serde(rename_all = "snake_case")]
pub struct SubMessageDetails {
    /// id of request sent to astroport contract
    pub sub_req_id: String,

    /// Name of the request type
    pub request_type: SubMessageType,

    pub next_action: SubMessageNextAction,

    pub sub_message_payload: Binary,

    pub funds: Vec<Coin>,
}
/// Map of request and list of their bonds. the key is request id and the
/// Value jsonified request
pub const SUB_MESSAGE_DETAILS: Map<String, SubMessageDetails> = Map::new("pending_request_details");

pub const SUB_REQ_ID: Item<u64> = Item::new("sub_req_id");
