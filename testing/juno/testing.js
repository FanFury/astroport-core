import {mnemonic} from "./constants.js";
import message from "@cosmostation/cosmosjs/src/messages/proto.js";

const {cosmos} = require("./constants.js");

let address = "juno1k02l3nzh7d7kzvmfd64h66eulj2h2qqdecwng2"

const privKey = cosmos.getECPairPriv(mnemonic);
const pubKeyAny = cosmos.getPubKeyAny(privKey);
console.log(pubKeyAny)
cosmos.getAccounts(address).then(data => {
    const msgSend = new message.cosmos.bank.v1beta1.MsgSend({
        from_address: address,
        to_address: "juno1k02l3nzh7d7kzvmfd64h66eulj2h2qqdecwng2",
        amount: [{denom: "ujuno", amount: String(100000)}]
    });
    const msgSendAny = new message.google.protobuf.Any({
        type_url: "/cosmos.bank.v1beta1.MsgSend",
        value: message.cosmos.bank.v1beta1.MsgSend.encode(msgSend).finish()
    });
    const txBody = new message.cosmos.tx.v1beta1.TxBody({messages: [msgSendAny], memo: ""});
    const signerInfo = new message.cosmos.tx.v1beta1.SignerInfo({
        public_key: pubKeyAny,
        mode_info: {single: {mode: message.cosmos.tx.signing.v1beta1.SignMode.SIGN_MODE_DIRECT}},
        sequence: data.account.sequence
    });
    const feeValue = new message.cosmos.tx.v1beta1.Fee({
        amount: [{denom: "uatom", amount: String(5000)}],
        gas_limit: 200000
    });
    const authInfo = new message.cosmos.tx.v1beta1.AuthInfo({signer_infos: [signerInfo], fee: feeValue});
    const signedTxBytes = cosmos.sign(txBody, authInfo, data.account.account_number, privKey);
    cosmos.broadcast(signedTxBytes).then(response => console.log(response));
});