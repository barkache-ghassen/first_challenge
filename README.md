
# Easy Web3 Challenge: Welcome

A Dockerized, beginner-friendly smart contract challenge. Players inspect the `Welcome` contract, interact with it on the local Hardhat network, and solve it by draining the contract balance. The challenge UI and solve-check API run inside the challenge environment.

## Repository Layout

```text
.
|-- Dockerfile                 # Packages the challenge into the Hamonis base image
|-- challenge_icon.png         # Desktop shortcut icon
|-- README.md                  # Repository and challenge-authoring guide
`-- challenge/
	|-- contracts/             # Solidity challenge contracts
	|-- ignition/modules/      # Hardhat Ignition deployment modules
	|-- contract.html          # Player-facing contract page
	|-- server.js              # Balance and solved-state API; reveals the flag when solved
	|-- server.py              # Serves the contract page on port 8000
	|-- getbalance.js          # Reads the deployed contract balance
	|-- flag.txt               # Secret flag; keep it out of public challenge content
	|-- run_challenge.sh       # Starts the local chain, deploys, and starts services
	|-- hardhat.config.js      # Hardhat configuration
	`-- package.json           # JavaScript dependencies
```

Hardhat also creates `cache/`, `artifacts/`, and deployment output under `ignition/deployments/`. These are generated when compiling or deploying; edit the contract and deployment module instead.

## Run With Docker

Build from the repository root. The `hamonis:base` image must already be available locally:

```sh
docker build -t hamonis:welcome_challenge1 .
docker run -d -p 8080:8080 --name hamonis-welcome hamonis:welcome_challenge1
```

Allow the container and challenge services to start before opening the challenge environment. To inspect startup output or stop the container:

```sh
docker logs -f hamonis-welcome
docker stop hamonis-welcome
```

The desktop shortcut opens the contract page at `http://localhost:8000`. The Node.js API listens on `127.0.0.1:3000` inside the container. The published Docker port `8080` is for the Hamonis desktop environment, not either challenge service.

## Build Another Easy Challenge

Use this project as the baseline and keep the same division of responsibilities:

1. **Write the challenge contract** in `challenge/contracts/`. Keep the intended objective understandable and ensure the contract can be deployed on the local Hardhat network.
2. **Add its deployment module** under `challenge/ignition/modules/`. Deploy the correct contract and provide any constructor arguments or initial value it needs.
3. **Update the player page** in `challenge/contract.html` to show the contract details, connection state, and interaction instructions appropriate to the challenge.
4. **Connect the solve check** in `challenge/getbalance.js` and `challenge/server.js`. Validate the win condition on the server; reveal the flag only after that condition is met.
5. **Set the flag** in `challenge/flag.txt`. Do not include the flag in public HTML, contract source, or other player-readable files.
6. **Update startup and packaging** if needed. `challenge/run_challenge.sh` starts the local chain, deploys the contract, and starts the services; the root `Dockerfile` copies `challenge/` into the image.
7. **Build and test** the challenge before publishing. Compile and run the Hardhat tests, then build the Docker image and verify the full player flow, including the unsolved and solved states.

Useful checks from the `challenge/` directory:

```sh
npm ci
npx hardhat compile
npx hardhat test
```

## Authoring Notes

- Keep each challenge self-contained under `challenge/`; reserve the root for image-level files and documentation.
- Keep contract names, deployment module references, and the balance-check logic in sync when changing the sample contract.
- Treat `flag.txt` and any player-visible files as separate trust boundaries. A hidden file is not secure if the web server exposes it.
- Add or update Hardhat tests for the intended solve condition and important failure cases.