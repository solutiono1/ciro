# Ciro contract

`src/Ciro.sol` is the invoice. `src/MockUSD8.sol` is a 6-decimal token for local tests. It is not tUSD8.

The product field "reference" is stored as `memo` because `reference` is a Solidity reserved word. The HTTP API calls that field `reference`.

From this directory, with `$HOME/.foundry/bin` on `PATH`:

```shell
forge test
forge build
```

EVM version is Shanghai. Do not lower it, and do not turn on Cancun opcodes. Aevum reverts on those at runtime.

`script/Deploy.s.sol` reads `CIRO_TOKEN`, `CIRO_FEE_RECIPIENT`, and `CIRO_FEE_BPS` from the environment. The contest fee is 0. Do not put a private key in the repo. Do not deploy until the owner provides a key.

The behavior and the tests are specified in `docs/architecture/ARCHITECTURE.md` and `docs/product/PRD.md`.
