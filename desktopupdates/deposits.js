const SHEET_TOKEN_ADDRESS = "0xYourSheetTokenAddress";
const GAME_DEPOSIT_ADDRESS = "0xYourGameWalletAddress"; // You control this private key securely on backend
const ERC20_ABI = [
  "function transfer(address to, uint amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint)",
  "function approve(address spender, uint amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint)"
];

async function depositSHEET(amount) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const tokenContract = new ethers.Contract(SHEET_TOKEN_ADDRESS, ERC20_ABI, signer);

  const amountInWei = ethers.parseUnits(amount.toString(), 18); // assuming 18 decimals

  if (amount > 1000) {
    alert("Maximum deposit is 1000 $SHEET per transaction");
    return;
  }

  try {
    const tx = await tokenContract.transfer(GAME_DEPOSIT_ADDRESS, amountInWei);
    await tx.wait();
    console.log("✅ Deposit complete:", tx.hash);

    // ✅ Enable spin button here:
    document.getElementById("spinButton").disabled = false;
    alert(`${amount} $SHEET deposited. You can now spin for ships!`);

  } catch (err) {
    console.error(err);
    alert("❌ Deposit failed");
  }
}
