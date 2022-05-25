import {Cosmos} from "@cosmostation/cosmosjs";
import message from "@cosmostation/cosmosjs/src/messages/proto.js";
// [WARNING] This mnemonic is just for the demo purpose. DO NOT USE THIS MNEMONIC for your own wallet.
const mnemonic = "example cruise forward hidden earth lizard tide guilt toy peace method slam turtle reflect close meat pond patrol rookie legend business brother acoustic thunder"
const chainId = "testing";
// This rest server URL may be disabled at any time. In order to maintain stable blockchain service, it is recommended to prepare your rest server.
// (https://hub.cosmos.network/main/gaia-tutorials/join-mainnet.html#enable-the-rest-api)
const cosmos = new Cosmos("http://127.0.0.1:1317", chainId);
cosmos.setBech32MainPrefix("juno");
const address = cosmos.getAddress(mnemonic);
const privKey = cosmos.getECPairPriv(mnemonic);
const pubKeyAny = cosmos.getPubKeyAny(privKey);

cosmos.getAccounts(address).then(data => {
    const msgSend = new message.cosmos.bank.v1beta1.MsgSend({
        from_address: address,
        to_address: "juno1kzwla3nejeqzj0qyfnjpwmhg7prw4qa82mc47p",
        amount: [{denom: "ujuno", amount: String(100000)}]		// 6 decimal places (1000000 uatom = 1 ATOM)
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
        amount: [{denom: "ujuno", amount: String(5000)}],
        gas_limit: 200000
    });

    const authInfo = new message.cosmos.tx.v1beta1.AuthInfo({signer_infos: [signerInfo], fee: feeValue});
    console.log(txBody)
    const signedTxBytes = cosmos.sign(txBody, authInfo, data.account.account_number, privKey);
    cosmos.broadcast(signedTxBytes).then(response => console.log(response));
});
