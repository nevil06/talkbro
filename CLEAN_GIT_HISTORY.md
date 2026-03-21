# 🧹 Clean Git History (Remove Exposed API Key)

## ⚠️ WARNING
This rewrites Git history and requires force push. Only do this if:
- You understand Git history rewriting
- You've coordinated with any team members
- You've backed up your repository

## Option 1: Use BFG Repo-Cleaner (Recommended)

### Step 1: Install BFG
Download from: https://rtyley.github.io/bfg-repo-cleaner/

### Step 2: Create a text file with the exposed key
```bash
echo "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" > secrets.txt
```

### Step 3: Run BFG
```bash
java -jar bfg.jar --replace-text secrets.txt talkbro
cd talkbro
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Step 4: Force push
```bash
git push --force origin main
```

## Option 2: Use git filter-branch

```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch whisper-server/start-server.bat" \
  --prune-empty --tag-name-filter cat -- --all

git reflog expire --expire=now --all
git gc --prune=now --aggressive

git push --force origin main
```

## Option 3: Just Revoke the Key (Easiest)

**This is the recommended approach:**

1. ✅ Revoke the old API key at https://build.nvidia.com/
2. ✅ Generate a new API key
3. ✅ Use the new key in your `.env` file
4. ✅ The old key in Git history is now useless

**The key in Git history can't be used if it's revoked!**

## After Cleaning

1. Verify the key is gone:
   ```bash
   git log --all --full-history -- "*start-server.bat*"
   ```

2. Check for any remaining secrets:
   ```bash
   git log -p | grep "nvapi-"
   ```

3. Notify GitHub that you've removed the secret (if they contacted you)

## Prevention

- ✅ Always use `.env` files for secrets
- ✅ Add `.env` to `.gitignore`
- ✅ Never commit API keys, passwords, or tokens
- ✅ Use environment variables
- ✅ Review commits before pushing
- ✅ Enable GitHub secret scanning alerts
