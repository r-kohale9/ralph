#!/usr/bin/env bash
#
# make-slideshow.sh — turn a folder of images into an MP4 slideshow with ffmpeg.
#
# Usage:
#   ./make-slideshow.sh <image-folder> [options]
#
# Options:
#   -d, --duration <sec>   Seconds each image is shown        (default: 1)
#   -o, --output <file>    Output video path                  (default: <folder>/slideshow.mp4)
#   -r, --fps <n>          Output frame rate                  (default: 30)
#   -s, --size <WxH>       Output resolution                  (default: 1920x1080)
#   -h, --help             Show this help and exit
#
# Supports mixed image types (png, jpg, jpeg, gif, bmp, webp, tiff) in natural
# sort order. Installs ffmpeg automatically if it is missing.
#
# Target OS: macOS, Linux
set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
DURATION=1
FPS=30
SIZE="1920x1080"
OUTPUT=""
FOLDER=""
IMAGE_EXTS=(png jpg jpeg gif bmp webp tiff tif)

err()  { printf 'Error: %s\n' "$*" >&2; }
info() { printf '%s\n'         "$*" >&2; }

usage() {
  sed -n '3,18p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    -d|--duration) DURATION="${2:?missing value for $1}"; shift 2 ;;
    -o|--output)   OUTPUT="${2:?missing value for $1}";   shift 2 ;;
    -r|--fps)      FPS="${2:?missing value for $1}";       shift 2 ;;
    -s|--size)     SIZE="${2:?missing value for $1}";      shift 2 ;;
    -h|--help)     usage 0 ;;
    -*)            err "unknown option: $1"; usage 1 ;;
    *)
      if [[ -z "$FOLDER" ]]; then
        FOLDER="$1"; shift
      else
        err "unexpected argument: $1"; usage 1
      fi
      ;;
  esac
done

[[ -n "$FOLDER" ]]    || { err "no image folder given"; usage 1; }
[[ -d "$FOLDER" ]]    || { err "not a directory: $FOLDER"; exit 1; }

# Validate numeric / size inputs early.
[[ "$DURATION" =~ ^[0-9]+([.][0-9]+)?$ ]] || { err "duration must be a number: $DURATION"; exit 1; }
[[ "$FPS"      =~ ^[0-9]+$ ]]             || { err "fps must be an integer: $FPS"; exit 1; }
[[ "$SIZE"     =~ ^[0-9]+x[0-9]+$ ]]      || { err "size must look like WxH (e.g. 1920x1080): $SIZE"; exit 1; }

WIDTH="${SIZE%x*}"
HEIGHT="${SIZE#*x}"

# Default output lives inside the source folder.
if [[ -z "$OUTPUT" ]]; then
  OUTPUT="${FOLDER%/}/slideshow.mp4"
fi

# ---------------------------------------------------------------------------
# Ensure ffmpeg is installed
# ---------------------------------------------------------------------------
install_ffmpeg() {
  local os; os="$(uname -s)"
  info "ffmpeg not found — attempting to install it..."

  case "$os" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        brew install ffmpeg
      else
        err "Homebrew is not installed. Install it from https://brew.sh then re-run, or install ffmpeg manually."
        exit 1
      fi
      ;;
    Linux)
      local sudo=""
      [[ "$(id -u)" -ne 0 ]] && sudo="sudo"
      if   command -v apt-get >/dev/null 2>&1; then $sudo apt-get update && $sudo apt-get install -y ffmpeg
      elif command -v dnf     >/dev/null 2>&1; then $sudo dnf install -y ffmpeg
      elif command -v yum     >/dev/null 2>&1; then $sudo yum install -y ffmpeg
      elif command -v pacman  >/dev/null 2>&1; then $sudo pacman -Sy --noconfirm ffmpeg
      elif command -v zypper  >/dev/null 2>&1; then $sudo zypper install -y ffmpeg
      elif command -v apk     >/dev/null 2>&1; then $sudo apk add ffmpeg
      else
        err "Could not detect a supported package manager. Please install ffmpeg manually."
        exit 1
      fi
      ;;
    *)
      err "Unsupported OS: $os. Please install ffmpeg manually."
      exit 1
      ;;
  esac
}

if ! command -v ffmpeg >/dev/null 2>&1; then
  install_ffmpeg
  command -v ffmpeg >/dev/null 2>&1 || { err "ffmpeg installation failed."; exit 1; }
fi

# ---------------------------------------------------------------------------
# Collect images (natural sort, mixed extensions, NUL-safe)
# ---------------------------------------------------------------------------
find_expr=()
for ext in "${IMAGE_EXTS[@]}"; do
  find_expr+=(-iname "*.${ext}" -o)
done
unset 'find_expr[${#find_expr[@]}-1]'   # drop trailing -o

images=()
while IFS= read -r -d '' f; do
  images+=("$f")
done < <(find "$FOLDER" -maxdepth 1 -type f \( "${find_expr[@]}" \) -print0 | sort -z -V)

[[ ${#images[@]} -gt 0 ]] || { err "no images found in: $FOLDER"; exit 1; }
info "Found ${#images[@]} image(s)."

# ---------------------------------------------------------------------------
# Build inputs + filter graph.
#
# Each image is loaded as its own input and individually scaled+padded to the
# target canvas, then all are concatenated. This is robust to images of mixed
# sizes and formats (the concat *demuxer* would reject differing resolutions).
# ---------------------------------------------------------------------------
inputs=()
filter=""
for i in "${!images[@]}"; do
  inputs+=(-loop 1 -t "$DURATION" -i "${images[$i]}")
  filter+="[${i}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,"
  filter+="pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}];"
done
for i in "${!images[@]}"; do filter+="[v${i}]"; done
filter+="concat=n=${#images[@]}:v=1:a=0,format=yuv420p[out]"

# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------
info "Rendering slideshow -> $OUTPUT"
ffmpeg -y "${inputs[@]}" \
  -filter_complex "$filter" \
  -map "[out]" \
  -c:v libx264 -r "$FPS" -pix_fmt yuv420p \
  "$OUTPUT"

info "Done: $OUTPUT"
