import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("=========================================");
console.log("🚀 Multi-Account Repo Pusher");
console.log("=========================================\n");
console.log("💡 PRO TIP for different accounts:");
console.log("To bypass your computer's saved GitHub credentials and push to a different account,");
console.log("use a Personal Access Token (PAT) in the URL format:");
console.log("👉 https://<YOUR_TOKEN>@github.com/username/repo.git\n");

rl.question('Enter the Target Repository URL:\n> ', (url) => {
  if (!url.trim()) {
    console.log("❌ Error: Repository URL is required.");
    rl.close();
    return;
  }

  rl.question('Enter commit message (default: "Update"):\n> ', (msg) => {
    const commitMsg = msg.trim() || "Update";
    
    try {
      // 1. Initialize git if not already
      try {
        execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
      } catch (e) {
        console.log("📦 Initializing Git repository...");
        execSync('git init', { stdio: 'inherit' });
      }

      // 2. Add all files
      console.log("\n📝 Adding files to staging...");
      execSync('git add .', { stdio: 'inherit' });
      
      // 3. Commit files
      try {
        execSync(`git commit -m "${commitMsg}"`, { stdio: 'ignore' });
        console.log("✅ Changes committed.");
      } catch (e) {
        console.log("ℹ️ No new changes to commit (working tree is clean).");
      }

      // 4. Get current branch
      let branch = 'main';
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        if (branch === 'HEAD') branch = 'main';
      } catch(e) {
        // If repo is completely empty with no commits
        execSync('git branch -M main', { stdio: 'ignore' }).catch(() => {});
      }

      // 5. Push directly to the provided URL
      console.log(`\n🚀 Pushing to branch '${branch}'...`);
      execSync(`git push -u "${url.trim()}" ${branch} --force`, { stdio: 'inherit' });
      
      console.log("\n🎉 Successfully pushed to the repository!");
    } catch (error) {
      console.log("\n❌ Failed to push to the repository.");
      console.log("\n🔍 Troubleshooting:");
      console.log("1. If pushing to a different GitHub account, make sure you generated a Personal Access Token (PAT).");
      console.log("2. Your URL should look like: https://ghp_yourTokenHere@github.com/your-username/your-repo.git");
      console.log("3. Ensure the remote repository actually exists on GitHub/GitLab.");
    }
    
    rl.close();
  });
});
