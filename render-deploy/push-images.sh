#!/usr/bin/env bash
# Builds the backend images on this laptop and pushes them to ONE private
# Docker Hub repository (the free plan allows one), as two tags:
#   YOUR-ID/roots18:meeting   the meeting service
#   YOUR-ID/roots18:backend   the main backend
# Each push also gets a dated tag, for example backend-20261111-1530, so you
# can go back to an older build.
#
# The images start with bin/render-start, which prepares the database, starts
# the job worker and starts the web server, so Render needs no start command.
#
#   bash render-deploy/push-images.sh YOUR-DOCKER-ID            both images
#   bash render-deploy/push-images.sh YOUR-DOCKER-ID backend    only the main backend
#   bash render-deploy/push-images.sh YOUR-DOCKER-ID meeting    only the meeting service
set -euo pipefail
cd "$(dirname "$0")/.."

user="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
which="${2:-both}"
repo="${DOCKER_REPO:-roots18}"

if [[ ! "$user" =~ ^[a-z0-9]{2,30}$ ]]; then
  echo "Give your Docker ID (your Docker Hub user name), for example:"
  echo "  bash render-deploy/push-images.sh myname"
  exit 1
fi
case "$which" in
  both) services=(meeting backend) ;;
  meeting | backend) services=("$which") ;;
  *) echo "The second word must be meeting, backend or nothing (both)."; exit 1 ;;
esac

# Docker on this laptop needs sudo unless your user is in the docker group.
if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  echo "Docker needs administrator rights here. Enter your laptop password if sudo asks."
  DOCKER=(sudo docker)
  if ! "${DOCKER[@]}" info >/dev/null 2>&1; then
    echo "Docker is not running. Start it with: sudo systemctl start docker"
    exit 1
  fi
fi

image="$user/$repo"

# A push to a repository that doesn't exist creates it, and it may be public.
# Docker Hub shows public repositories to anyone, so check before pushing code.
check_file="$(mktemp)"
status="$(curl -4 -s --max-time 20 -o "$check_file" -w '%{http_code}' \
  "https://hub.docker.com/v2/repositories/$image/" || true)"
if [ "$status" = "200" ] && grep -q '"is_private": *false' "$check_file"; then
  rm -f "$check_file"
  echo "Docker Hub says $image is PUBLIC: anyone could download the code."
  echo "Open it on hub.docker.com, Settings, Change visibility, Private. Then run this again."
  exit 1
fi
rm -f "$check_file"
if [ "$status" != "200" ]; then
  echo "Docker Hub shows no public repository named $image. That's right if you"
  echo "created it as Private (DEPLOY.md, Step 2). If you didn't, the push would"
  echo "create it, possibly as public."
  read -r -p "Did you create $image as a Private repository? Type yes to go on: " answer
  if [ "$answer" != "yes" ]; then
    echo "Stopped. Create the repository first (Step 2), then run this again."
    exit 1
  fi
fi

echo
echo "Signing in to Docker Hub as $user."
echo "When it asks for a password, paste your Docker Hub access token (the Read & Write one)."
echo "Nothing shows while you paste; press Enter afterwards."
"${DOCKER[@]}" login -u "$user"

stamp="$(date +%Y%m%d-%H%M)"
pushed=()
for service in "${services[@]}"; do
  if [ "$service" = "meeting" ]; then folder="meeting-service/api"; else folder="main-backend"; fi
  local_tag="roots18-$service:build"

  echo
  echo "== Building the $service image from $folder (the first build takes 5 to 15 minutes)"
  "${DOCKER[@]}" build --platform linux/amd64 -t "$local_tag" "$folder"

  # Same image, started with bin/render-start instead of only the web server.
  printf 'FROM %s\nCMD ["sh", "bin/render-start"]\n' "$local_tag" \
    | "${DOCKER[@]}" build --platform linux/amd64 -t "$image:$service" -t "$image:$service-$stamp" -

  echo "== Pushing $image:$service"
  for attempt in 1 2 3; do
    if "${DOCKER[@]}" push "$image:$service" && "${DOCKER[@]}" push "$image:$service-$stamp"; then
      break
    fi
    if [ "$attempt" = 3 ]; then
      echo "The push failed three times. Check the network and run the same command again."
      exit 1
    fi
    echo "Push failed; trying again in 10 seconds..."
    sleep 10
  done
  pushed+=("$service")
done

echo
echo "Done. Image addresses for Render (Image URL):"
for service in "${pushed[@]}"; do
  echo "  docker.io/$image:$service      (this build is also saved as $service-$stamp)"
done
echo
echo "Already running on Render? Open the service and click Manual Deploy, then"
echo "Deploy latest reference. Render doesn't pick up new images by itself."
