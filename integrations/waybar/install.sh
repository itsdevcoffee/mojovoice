#!/bin/bash
# Waybar Integration Installer for dev-voice
# Installs dev-voice module into Waybar configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Paths
WAYBAR_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/waybar"
INTEGRATION_DIR="$WAYBAR_DIR/integrations/dev-voice"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}=== dev-voice Waybar Integration Installer ===${NC}"
echo ""

# Check if Waybar config exists
if [ ! -d "$WAYBAR_DIR" ]; then
    echo -e "${RED}Error: Waybar config directory not found at $WAYBAR_DIR${NC}"
    echo "Please install and configure Waybar first."
    exit 1
fi

# Create integration directory
echo -e "${YELLOW}Creating integration directory...${NC}"
mkdir -p "$INTEGRATION_DIR"

# Copy files
echo -e "${YELLOW}Installing files...${NC}"
cp "$SCRIPT_DIR/dev-voice-status.sh" "$INTEGRATION_DIR/"
chmod +x "$INTEGRATION_DIR/dev-voice-status.sh"
cp "$SCRIPT_DIR/module.jsonc" "$INTEGRATION_DIR/"
cp "$SCRIPT_DIR/style.css" "$INTEGRATION_DIR/"

echo -e "${GREEN}✓ Files installed to $INTEGRATION_DIR${NC}"
echo ""

# Instructions
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Add this line to your Waybar config ($WAYBAR_DIR/config.jsonc):"
echo -e "   ${GREEN}\"include\": [\"~/.config/waybar/integrations/dev-voice/module.jsonc\"]${NC}"
echo ""
echo "2. Add 'custom/dev-voice' to one of your module lists:"
echo -e "   ${GREEN}\"modules-left\": [..., \"custom/dev-voice\"]${NC}"
echo ""
echo "3. (Optional) Import the CSS into your style.css:"
echo -e "   ${GREEN}@import \"integrations/dev-voice/style.css\";${NC}"
echo ""
echo "4. Reload Waybar:"
echo -e "   ${GREEN}pkill -SIGUSR2 waybar${NC}"
echo ""
echo "5. Configure dev-voice to refresh Waybar on state changes:"
echo "   Run: dev-voice config"
echo "   Add this line to the [output] section:"
echo -e "   ${GREEN}refresh_command = \"pkill -RTMIN+8 waybar\"${NC}"
echo ""
