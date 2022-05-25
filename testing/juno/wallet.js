import {cosmos} from "./constants.js";
import message from "@cosmostation/cosmosjs/src/messages/proto.js";
import fs from "fs";


export class Wallet {
    wallet_address;
    publicKey;
    privateKey;

    constructor(memonic) {
        this.privateKey = cosmos.getECPairPriv(memonic);
        this.publicKey = cosmos.getPubKeyAny(this.privateKey);
        this.wallet_address = cosmos.getAddress(memonic);
        this.feeValue = new message.cosmos.tx.v1beta1.Fee({
            amount: [{denom: "ujuno", amount: String(500)}],
            gas_limit: 200000
        });
    }

    sign_and_broadcast(messages) {
        cosmos.getAccounts(this.wallet_address).then(data => {
            let signerInfo = new message.cosmos.tx.v1beta1.SignerInfo({
                public_key: this.publicKey,
                mode_info: {single: {mode: message.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT}},
                sequence: data.account.sequence
            });
            const txBody = new message.cosmos.tx.v1beta1.TxBody({messages: messages, memo: ""});
            const authInfo = new message.cosmos.tx.v1beta1.AuthInfo({signer_infos: [signerInfo], fee: this.feeValue});
            const signedTxBytes = cosmos.sign(txBody, authInfo, data.account.account_number, this.privateKey);
            cosmos.broadcast(signedTxBytes).then(response => {
                console.log(response)
                return response
            });
        })
    }

    send_funds(to_address, coins) {
        const msgSend = new message.cosmos.bank.v1beta1.MsgSend({
            from_address: this.wallet_address,
            to_address: to_address,
            amount: [coins]
        });
        const msgSendAny = new message.google.protobuf.Any({
            type_url: "/cosmos.bank.v1beta1.MsgSend",
            value: message.cosmos.bank.v1beta1.MsgSend.encode(msgSend).finish()
        });
        this.sign_and_broadcast([msgSendAny])
    }

    execute_contract(msg, contractAddress) {
        let msg_list = []
        if (Array.isArray(msg)) {
            msg.forEach((msg) => {
                msg_list.push(this.get_execute(msg, contractAddress))
            })

        } else {
            msg_list = [
                this.get_execute(msg, contractAddress)
            ]
        }
        this.sign_and_broadcast(msg_list)

    }

    get_execute(message, contract) {
        let transferBytes = new Buffer(JSON.stringify(message));
        const msgExecuteContract = new message.cosmwasm.wasm.v1.MsgExecuteContract({
            sender: this.wallet_address,
            contract: contract,
            msg: transferBytes,
            funds: []
        });
        return new message.google.protobuf.Any({
            type_url: "/cosmwasm.wasm.v1.MsgExecuteContract",
            value: message.cosmwasm.wasm.v1.MsgExecuteContract.encode(msgExecuteContract).finish()
        })
    }

    query(address, query) {
        cosmos.wasmQuery(
            address,
            JSON.stringify(query)
        ).then(json => {
            return json
        })
    }

    upload(file) {
        const code = fs.readFileSync(file).toString("base64");
        const msgStoreCode = new message.cosmwasm.wasm.v1.MsgStoreCode({
            sender: this.wallet_address,
            wasm_byte_code: code,
        });
        this.sign_and_broadcast([{
            type_url: "/cosmwasm.wasm.v1.MsgStoreCode",
            value: message.cosmwasm.wasm.v1.MsgStoreCode.encode(msgStoreCode).finish()
        }])

    }

    init(code_id, contract_init) {
        let transferBytes = new Buffer(JSON.stringify(contract_init));
        const msgInit = new message.cosmwasm.wasm.v1.MsgInstantiateContract({
            sender: this.wallet_address,
            admin: this.wallet_address,
            codeId: code_id,
            initMsg: transferBytes,
            initFunds: []
        });
        this.sign_and_broadcast([{
            type_url: "/cosmwasm.wasm.v1.MsgInstantiateContract",
            value: message.cosmwasm.wasm.v1.MsgInstantiateContract.encode(msgInit).finish()
        }])

    }


}

const mnemonic = "example cruise forward hidden earth lizard tide guilt toy peace method slam turtle reflect close meat pond patrol rookie legend business brother acoustic thunder"
let wallet = new Wallet(mnemonic)
wallet.upload("../../artifacts/astroport_token.wasm")