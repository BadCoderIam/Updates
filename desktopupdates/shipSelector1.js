export let selectedShip = null;
export let claimedShip = null;

const spinButton = document.getElementById('spin-button');
const claimButton = document.getElementById('claim-button');
const startButton = document.getElementById('startButton');
const slot = document.getElementById('slot');
const result = document.getElementById('result');
const depositButton = document.getElementById('deposit-button');
const depositInput = document.getElementById('deposit-amount');
const depositedDisplay = document.getElementById('deposited-display');

const COST_PER_SPIN = 100;
const MAX_DEPOSIT = 1000;

let depositedCoins = 0; // 💰 Coins available for spinning

const rarities = [
  { color: 'red', rarity: 'Common', weight: 10 },
  { color: 'green', rarity: 'Uncommon', weight: 6 },
  { color: 'blue', rarity: 'Rare', weight: 3 },
  { color: 'orange', rarity: 'Epic', weight: 1 }
];

const ships = [];
for (let shipNum = 1; shipNum <= 3; shipNum++) {
  rarities.forEach(r => {
    for (let i = 0; i < r.weight; i++) {
      ships.push({
        image: `/Sprites/playerShip${shipNum}_${r.color}.png`,
        rarity: r.rarity,
        color: r.color,
        shipNum: shipNum
      });
    }
  });
}

function getRandomShip() {
  return ships[Math.floor(Math.random() * ships.length)];
}

function resetSlotBorder() {
  slot.style.borderColor = 'rgba(139, 69, 19, 1)';
  slot.style.boxShadow = 'none';
  slot.style.animation = 'none';
}

function determineResult(finalShip) {
  result.innerHTML = `🎉 You got a <strong style="color:${finalShip.color}">${finalShip.rarity}</strong> Ship <strong>#${finalShip.shipNum}</strong>!`;
  slot.style.borderColor = 'gold';
  claimButton.style.display = 'inline-block';
  selectedShip = finalShip;
  slot.innerHTML = `<img src="${finalShip.image}" style="width:80px;height:auto;">`;
}

function spinSlotMachine() {
  if (spinButton.disabled || depositedCoins < COST_PER_SPIN) {
    alert("❌ Not enough $SHEET to spin.");
    return;
  }

  depositedCoins -= COST_PER_SPIN;
  updateDepositedDisplay();

  spinButton.disabled = true;
  spinButton.style.opacity = 0.5;
  claimButton.style.display = 'none';
  result.textContent = '';
  resetSlotBorder();

  let spinCount = 0;
  const maxSpins = 50;
  const interval = setInterval(() => {
    const randomShip = getRandomShip();
    slot.innerHTML = `<img src="${randomShip.image}" style="width:80px;height:auto;">`;
    spinCount++;

    if (spinCount >= maxSpins) {
      clearInterval(interval);
      determineResult(getRandomShip());
      spinButton.disabled = false;
      spinButton.style.opacity = 1;

      if (depositedCoins < COST_PER_SPIN) {
        alert("⚠️ No more spins available. Refunding unused coins...");
        refundUnusedCoins(depositedCoins);
        depositedCoins = 0;
        updateDepositedDisplay();
      }
    }
  }, 50);
}

function setStartingImage() {
  slot.style.backgroundColor = 'transparent';
  slot.innerHTML = '';
  resetSlotBorder();
}

function updateDepositedDisplay() {
  depositedDisplay.textContent = `💰 Available $SHEET: ${depositedCoins}`;
}

// Deposit button click handler
depositButton.addEventListener('click', async () => {
  const amount = parseInt(depositInput.value);
  if (isNaN(amount) || amount <= 0 || amount > MAX_DEPOSIT) {
    alert(`Enter a valid deposit amount (1-${MAX_DEPOSIT})`);
    return;
  }

  try {
    await depositSHEET(amount);
    depositedCoins += amount;
    updateDepositedDisplay();
  } catch (err) {
    console.error(err);
    alert("❌ Deposit failed.");
  }
});

claimButton.addEventListener('click', () => {
  if (selectedShip) {
    claimedShip = selectedShip;
    claimButton.style.display = 'none';
    startButton.style.display = 'inline-block';
  } else {
    alert("No ship selected to claim!");
  }
});

setStartingImage();
updateDepositedDisplay();

export function getSelectedShip() {
  return claimedShip;
}

// ✅ Replace this with your actual $SHEET deposit logic
async function depositSHEET(amount) {
  alert(`✅ Simulated deposit of ${amount} $SHEET to game.`);

  // Replace with your real ethers.js deposit code when ready
  // Example from earlier:
  // const tx = await tokenContract.transfer(GAME_DEPOSIT_ADDRESS, amountInWei);
  // await tx.wait();
}

async function refundUnusedCoins(amount) {
  if (amount <= 0) return;
  alert(`✅ Refunded ${amount} $SHEET`);
  // ⚠ Replace with actual refund transfer via ethers.js
}
