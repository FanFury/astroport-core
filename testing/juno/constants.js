import {Cosmos} from "@cosmostation/cosmosjs";

/*
docker run -it --name juno_node_1 -p 26656:26656 -p 26657:26657 -p 1317:1317 -e STAKE_TOKEN=ujunox -e UNSAFE_CORS=true ghcr.io/cosmoscontracts/juno:v5.0.1 ./setup_and_run.sh
Use This command To Up the Local JUNO
* */
const chainId = "testing"
const lcdUrl = "http://127.0.0.1:1317"
// Copy Memonic from the Terminal in which the Juno Node contrainer was upped
export const mnemonic = "ocean elevator conduct amazing december program coyote regular shoulder quote script grace matrix film alley accident indicate stock require practice inhale shock symbol soul"
export const cosmos = new Cosmos(lcdUrl, chainId);
cosmos.setBech32MainPrefix("juno")
console.log(cosmos.bech32MainPrefix)