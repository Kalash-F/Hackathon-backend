// This script reads the wallet keypair from the deployment wallet file
// and converts it to a format that can be imported into the UI.

const fs = require('fs');

// Path to the deployment wallet file
const WALLET_FILE = './wallet/deployment-wallet.json';

try {
  // Read the wallet file
  const walletData = fs.readFileSync(WALLET_FILE, 'utf8');
  const walletJson = JSON.parse(walletData);
  
  // Extract the secret key
  const secretKey = walletJson;
  
  // Log the secret key in a format that can be copied
  console.log('Copy the following line to set up your wallet in the UI:');
  console.log('localStorage.setItem("deploymentWallet", \'' + JSON.stringify(secretKey) + '\');');
  
  // Create an exportable HTML file
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Import Deployment Wallet</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .code { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-wrap: break-word; }
    button { padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; }
    .success { color: green; margin-top: 10px; display: none; }
  </style>
</head>
<body>
  <h1>Import Deployment Wallet</h1>
  <p>Click the button below to import the deployment wallet to your browser's localStorage:</p>
  
  <button onclick="importWallet()">Import Wallet</button>
  <div class="success" id="success">Wallet imported successfully!</div>
  
  <h2>Manual Import</h2>
  <p>Alternatively, open your browser console and paste this code:</p>
  <div class="code">${'localStorage.setItem("deploymentWallet", \'' + JSON.stringify(secretKey) + '\');'}</div>
  
  <script>
    function importWallet() {
      try {
        localStorage.setItem("deploymentWallet", '${JSON.stringify(secretKey)}');
        document.getElementById("success").style.display = "block";
      } catch (error) {
        alert("Error importing wallet: " + error.message);
      }
    }
  </script>
</body>
</html>
  `;
  
  // Write the HTML file
  fs.writeFileSync('./wallet/import_wallet.html', htmlContent);
  
  console.log('HTML import file created at ./wallet/import_wallet.html');
  console.log('Open this file in your browser to easily import the wallet');
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('Make sure you have created a deployment wallet using: ./persistent_deploy.sh');
} 