import {cosmos, mnemonic} from "./constants.js";
import message from "@cosmostation/cosmosjs/src/messages/proto.js";


export class Wallet {
    wallet_address;
    publicKey;
    privateKey;

    constructor(memonic) {
        this.privateKey = cosmos.getECPairPriv(memonic);
        this.publicKey = cosmos.getPubKeyAny(this.privateKey);
        this.wallet_address = cosmos.getAddress(memonic);
        this.feeValue = new message.cosmos.tx.v1beta1.Fee({
            amount: [{denom: "ujunox", amount: String(500)}],
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
        // TODO Messge JSON here needs to be stringified
        let transferBytes = new Buffer(message);
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


}

let wallet = new Wallet(mnemonic)
wallet.send_funds("juno1gcxq5hzxgwf23paxld5c9z0derc9ac4m5g63xa", {denom: "ujunox", amount: String(100)})