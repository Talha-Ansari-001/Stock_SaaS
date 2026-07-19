const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend', 'src');

function walkAndReplace(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkAndReplace(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Replace single-quoted string
      content = content.replace(/'http:\/\/localhost:5000([^']*)'/g, 
        "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`"
      );
      // Replace double-quoted string
      content = content.replace(/"http:\/\/localhost:5000([^"]*)"/g, 
        "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`"
      );
      // Replace template literals containing it
      content = content.replace(/`http:\/\/localhost:5000([^`]*)`/g, 
        "`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}$1`"
      );
      
      fs.writeFileSync(fullPath, content);
      console.log(`Updated ${fullPath}`);
    }
  }
}

walkAndReplace(dir);
console.log("Done");
