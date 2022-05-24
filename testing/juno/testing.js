import {mnemonic} from "./constants.js";
import message from "@cosmostation/cosmosjs/src/messages/proto.js";

import {cosmos} from "./constants.js";

let address = "juno16g2rahf5846rxzp3fwlswy08fz8ccuwk03k57y"

const privKey = cosmos.getECPairPriv(mnemonic);
const pubKeyAny = cosmos.getPubKeyAny(privKey);
console.log(pubKeyAny)
cosmos.getAccounts(address).then(data => {
    console.log(data);
    const msgSend = new message.cosmos.bank.v1beta1.MsgSend({
        from_address: address,
        to_address: "juno1gcxq5hzxgwf23paxld5c9z0derc9ac4m5g63xa",
        amount: [{denom: "ujunox", amount: String(100)}]
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
        amount: [{denom: "ujunox", amount: String(500)}],
        gas_limit: 200000
    });
    const authInfo = new message.cosmos.tx.v1beta1.AuthInfo({signer_infos: [signerInfo], fee: feeValue});
    const signedTxBytes = cosmos.sign(txBody, authInfo, data.account.account_number, privKey);
    cosmos.broadcast(signedTxBytes).then(response => console.log(response));
});