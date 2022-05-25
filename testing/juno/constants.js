import {Cosmos} from "@cosmostation/cosmosjs";

/*
docker run -it --name juno_node_1 -p 26656:26656 -p 26657:26657 -p 1317:1317 -e STAKE_TOKEN=ujunox -e UNSAFE_CORS=true ghcr.io/cosmoscontracts/juno:v5.0.1 ./setup_and_run.sh juno16g2rahf5846rxzp3fwlswy08fz8ccuwk03k57y
Use This command To Up the Local JUNO
* */
const chainId = "testing"
const lcdUrl = "http://127.0.0.1:1317"
// Copy Memonic from the Terminal in which the Juno Node contrainer was upped
export const mnemonic = "example cruise forward hidden earth lizard tide guilt toy peace method slam turtle reflect close meat pond patrol rookie legend business brother acoustic thunder"
export const cosmos = new Cosmos(lcdUrl, chainId);
cosmos.setBech32MainPrefix("juno")
console.log(cosmos.bech32MainPrefix)