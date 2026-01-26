# Git Repository Update Guide

This guide provides comprehensive instructions for updating your OB-UDPST Web GUI installation from the git repository, including clearing all caches and ensuring a clean rebuild.

## Table of Contents

- [Quick Update](#quick-update)
- [Manual Update Process](#manual-update-process)
- [Cache Clearing](#cache-clearing)
- [Troubleshooting](#troubleshooting)
- [Common Issues](#common-issues)

## Quick Update

Use the automated update script for the fastest update process:

```bash
chmod +x update-project.sh
./update-project.sh
```

This script will automatically:
- Stash any local changes
- Clear all caches (git, npm, build artifacts)
- Pull the latest changes
- Reinstall dependencies
- Rebuild the project
- Verify the build

## Manual Update Process

If you prefer to update manually or need more control, follow these steps:

### Step 1: Save Local Changes

Before updating, save any uncommitted changes:

```bash
git status
git stash save "Local changes before update"
```

### Step 2: Clear Git Cache

Remove cached files and reset to HEAD:

```bash
git rm -r --cached .
git reset --hard HEAD
```

### Step 3: Fetch Latest Changes

Pull the latest version from the repository:

```bash
git fetch origin
git pull origin main
```

If you're working with a different branch:

```bash
git pull origin <branch-name>
```

### Step 4: Restore Local Changes (Optional)

If you stashed changes and want to restore them:

```bash
git stash list
git stash pop
```

**Note:** This may cause merge conflicts if the updated code conflicts with your changes.

### Step 5: Clear All Caches

#### Clear npm Cache

```bash
npm cache clean --force
```

#### Remove All node_modules Directories

```bash
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/node_modules
```

#### Clear Build Artifacts

```bash
rm -rf frontend/dist
rm -rf frontend/.vite
rm -rf backend/dist
```

#### Clear Frontend Vite Cache

```bash
rm -rf frontend/node_modules/.vite
```

### Step 6: Reinstall Dependencies

Install dependencies for all parts of the project:

```bash
npm run install:all
```

Or install individually:

```bash
cd backend
npm install
cd ..

cd frontend
npm install
cd ..

npm install
```

### Step 7: Rebuild the Project

```bash
npm run build
```

### Step 8: Verify Installation

Check that everything is working:

```bash
npm run start:backend
```

In another terminal:

```bash
npm run start:frontend
```

## Cache Clearing

### Complete Cache Clear

To perform a thorough cache clear:

```bash
# Clear npm cache
npm cache clean --force

# Clear yarn cache (if using yarn)
yarn cache clean

# Remove all node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

# Clear build artifacts
rm -rf frontend/dist frontend/.vite backend/dist

# Clear git cache
git rm -r --cached .
git reset --hard HEAD
```

### Selective Cache Clearing

#### Only Clear npm Cache

```bash
npm cache clean --force
```

#### Only Clear Build Artifacts

```bash
rm -rf frontend/dist
rm -rf frontend/.vite
```

#### Only Clear Backend Dependencies

```bash
rm -rf backend/node_modules
cd backend && npm install && cd ..
```

#### Only Clear Frontend Dependencies

```bash
rm -rf frontend/node_modules
cd frontend && npm install && cd ..
```

## Troubleshooting

### Issue: "Permission Denied" Errors

If you encounter permission errors during the update:

```bash
sudo chown -R $(whoami) .
chmod +x update-project.sh
```

### Issue: Merge Conflicts After Pull

If you have merge conflicts:

```bash
git status
git diff
```

Resolve conflicts manually, then:

```bash
git add .
git commit -m "Resolved merge conflicts"
```

### Issue: npm Install Fails

Try clearing the lock file and reinstalling:

```bash
rm package-lock.json
rm backend/package-lock.json
rm frontend/package-lock.json
npm cache clean --force
npm run install:all
```

### Issue: Build Fails After Update

Ensure all dependencies are properly installed:

```bash
npm run install:all
npm cache clean --force
npm run build
```

### Issue: Port Already in Use

If the backend or frontend port is already in use:

```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

Then restart the services.

### Issue: Git Pull Rejects Due to Local Changes

If git refuses to pull due to local changes:

```bash
git stash
git pull origin main
git stash pop
```

Or if you want to discard local changes:

```bash
git reset --hard HEAD
git pull origin main
```

## Common Issues

### Stale Dependencies

If you're experiencing issues with outdated dependencies:

```bash
rm -rf node_modules backend/node_modules frontend/node_modules
rm package-lock.json backend/package-lock.json frontend/package-lock.json
npm run install:all
```

### Build Cache Issues

If builds are using old cached files:

```bash
rm -rf frontend/.vite frontend/dist
npm run build:frontend
```

### Environment Variables Not Loading

After updating, ensure your `.env` files are present:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Edit the `.env` files with your configuration.

### Docker Updates

If using Docker:

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Best Practices

1. **Always backup your `.env` files** before updating
2. **Review the CHANGELOG.md** to understand what changed
3. **Test in a development environment** before updating production
4. **Keep your local changes minimal** or use feature branches
5. **Clear caches regularly** to avoid build issues
6. **Document any custom modifications** you make

## Update Frequency

We recommend checking for updates:
- **Weekly** for security patches
- **Monthly** for feature updates
- **Before production deployments** to ensure stability

## Getting Help

If you encounter issues not covered here:

1. Check the [CHANGELOG.md](./CHANGELOG.MD) for known issues
2. Review the [README.md](./README.md) for general documentation
3. Check the [WEB_GUI_README.md](./WEB_GUI_README.md) for web GUI specifics
4. Open an issue on the project repository

## Version Management

After updating, verify your version:

```bash
git log -1 --oneline
git describe --tags
```

Keep track of your current version in your deployment notes.

---

**Last Updated:** 2026-01-26
