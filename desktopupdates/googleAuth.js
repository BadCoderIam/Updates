// googleAuth.js
<<<<<<< HEAD
import { claimedShip } from '/shipSelector.js';
import { setClaimedShip } from '/shipSelector.js';
import { Web3Auth } from "@web3auth/modal";
import { OpenloginAdapter } from "@web3auth/openlogin-adapter";
import { ethers } from 'ethers';

let currentUser = null;
export const authState = {
  user: null,
  walletAddress: null,
};

// Generate a new random wallet (address + private key)
const wallet = ethers.Wallet.createRandom();

console.log('Wallet address:', wallet.address);
console.log('Private key (keep secret!):', wallet.privateKey);

const web3auth = new Web3Auth({
  clientId: "YOUR_WEB3AUTH_CLIENT_ID", // Replace this with your Web3Auth Client ID
  web3AuthNetwork: "testnet", // or "mainnet" for production
  chainConfig: {
    chainNamespace: "eip155",
    chainId: "0x1", // Ethereum Mainnet
    rpcTarget: "https://rpc.ankr.com/eth",
  },
});

const openloginAdapter = new OpenloginAdapter({
  adapterSettings: { network: "testnet", clientId: "YOUR_WEB3AUTH_CLIENT_ID" },
});
web3auth.configureAdapter(openloginAdapter);

await web3auth.initModal();

export async function initializeGoogleWalletLogin() {
  const provider = await web3auth.connect(); // Will trigger Google OAuth login
  const userInfo = await web3auth.getUserInfo();

  authState.user = {
    id: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.profileImage,
  };

  const accounts = await provider.request({ method: "eth_accounts" });
  authState.walletAddress = accounts[0];

  document.getElementById("userInfo").innerText = `Welcome, ${authState.user.name}! Wallet: ${shorten(accounts[0])}`;

  // ✅ Save to your backend for record-keeping
  await fetch("http://localhost:3000/api/save-user-wallet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      googleUserId: authState.user.id,
      googleUserName: authState.user.name,
      googleUserEmail: authState.user.email,
      walletAddress: authState.walletAddress,
    }),
  });

  // ✅ FETCH PREVIOUS CLAIMED SHIPS HERE
  fetch(`http://localhost:3000/api/user-claims/${authState.user.id}`)
    .then((res) => res.json())
    .then((claimData) => {
      if (claimData.success && claimData.claims.length > 0) {
        displayUserClaims(claimData.claims);
      }
    })
    .catch(console.error);
}

function shorten(address) {
  return address.slice(0, 6) + "..." + address.slice(-4);
}

export function getCurrentUser() {
  return authState.user;
}

export function logoutGoogle() {
  web3auth.logout();
  authState.user = null;
  authState.walletAddress = null;
}

export function displayUserClaims(claims) {
  const box = document.getElementById("previousClaimsBox");
  const list = document.getElementById("previousClaimsList");

  list.innerHTML = "";
  box.style.display = claims.length ? "block" : "none";

  if (claims.length === 0) {
    list.textContent = "No previous claims found.";
=======
import { claimedShip } from './shipSelector.js';
import { setClaimedShip } from './shipSelector.js';

let currentUser = null;
// ✅ Create an object to hold it by reference
export const authState = {
  user: null,
};

export function initializeGoogleSignIn(clientId) {
  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleCredentialResponse,
  });

  google.accounts.id.renderButton(
    document.getElementById("googleLoginButton"),
    { theme: "outline", size: "medium" }
  );
}

function handleCredentialResponse(response) {
  fetch('https://www.sheethole.net/api/google-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: response.credential }),
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      authState.user = data.user;  // ✅ Save user info
      document.getElementById('userInfo').innerText = `Welcome, ${data.user.name}!`;

      // ✅ FETCH PREVIOUS CLAIMED SHIPS HERE
      fetch(`https://www.sheethole.net/api/user-claims/${authState.user.id}`)
        .then(res => res.json())
        .then(claimData => {
          if (claimData.success && claimData.claims.length > 0) {
            displayUserClaims(claimData.claims);
          }
        })
        .catch(console.error);
    }
  })
  .catch(console.error);
}

export function getCurrentUser() {
  return currentUser;
}

export function logoutGoogle() {
  google.accounts.id.disableAutoSelect();
  currentUser = null;
}

export function displayUserClaims(claims) {
  const box = document.getElementById('previousClaimsBox');
  const list = document.getElementById('previousClaimsList');

  list.innerHTML = '';
  box.style.display = claims.length ? 'block' : 'none';

  if (claims.length === 0) {
    list.textContent = 'No previous claims found.';
>>>>>>> cfa487cefb37342c49838263347b7762a07f59f0
    return;
  }

  const lastThree = claims.slice(0, 3);

<<<<<<< HEAD
  lastThree.forEach((claim) => {
    const claimDiv = document.createElement("div");
    claimDiv.style.marginBottom = "0.8rem";
    claimDiv.style.textAlign = "center";
=======
  lastThree.forEach(claim => {
    const claimDiv = document.createElement('div');
    claimDiv.style.marginBottom = '0.8rem';
    claimDiv.style.textAlign = 'center';
>>>>>>> cfa487cefb37342c49838263347b7762a07f59f0

    claimDiv.innerHTML = `
      <img src="${claim.image_url}" alt="Ship" style="width: 60px; height: 60px;"><br>
      <strong>Ship #${claim.ship_number}</strong> | ${claim.rarity} (${claim.color})<br>
    `;

<<<<<<< HEAD
    const selectButton = document.createElement("button");
    selectButton.textContent = "Select This Ship";
    selectButton.style.marginTop = "0.3rem";
    selectButton.style.padding = "0.2rem 0.5rem";
    selectButton.style.borderRadius = "6px";
    selectButton.style.border = "none";
    selectButton.style.backgroundColor = "gold";
    selectButton.style.color = "#222";
    selectButton.style.cursor = "pointer";
=======
    const selectButton = document.createElement('button');
    selectButton.textContent = 'Select This Ship';
    selectButton.style.marginTop = '0.3rem';
    selectButton.style.padding = '0.2rem 0.5rem';
    selectButton.style.borderRadius = '6px';
    selectButton.style.border = 'none';
    selectButton.style.backgroundColor = 'gold';
    selectButton.style.color = '#222';
    selectButton.style.cursor = 'pointer';
>>>>>>> cfa487cefb37342c49838263347b7762a07f59f0

    selectButton.onclick = () => {
      setClaimedShip({
        shipNum: claim.ship_number,
        rarity: claim.rarity,
        color: claim.color,
<<<<<<< HEAD
        image: claim.image_url,
      });

      document.getElementById("claim-button").style.display = "none";
      document.getElementById("startButton").style.display = "inline-block";

      console.log("✅ Selected previous claimed ship:", claim);
=======
        image: claim.image_url
      });

      document.getElementById('claim-button').style.display = 'none';
      document.getElementById('startButton').style.display = 'inline-block';

      console.log('✅ Selected previous claimed ship:', claim);
>>>>>>> cfa487cefb37342c49838263347b7762a07f59f0
    };

    claimDiv.appendChild(selectButton);
    list.appendChild(claimDiv);
  });
}
