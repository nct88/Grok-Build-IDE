R=`git status --porcelain | wc -l`
if [ "$R" -ne "0" ]; then
  echo "The git repo is not clean after compiling the build folder."
  git status --porcelain
  git --no-pager diff
  git --no-pager diff --cached
  exit 1
fi
