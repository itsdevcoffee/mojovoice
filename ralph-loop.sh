#!/bin/bash
# Ralph Loop - Autonomous UI/UX Overhaul
# Runs continuous iterations until all tasks complete

set -e

echo "🔄 Starting Ralph Loop for MojoVoice UI/UX Overhaul"
echo "📋 Branch: ui-overhaul-v0.6.0"
echo "📝 Tasks: See plan.md"
echo "📊 Progress: claude-progress.txt"
echo ""
echo "Press Ctrl+C to stop the loop"
echo ""

# Create logs directory
mkdir -p logs

# Iteration counter
ITERATION=1

while :; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔁 Iteration $ITERATION - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Run Claude with prompt
  LOG_FILE="logs/iteration-$(date +%s).log"

  if claude -p "$(cat PROMPT.md)" --dangerously-skip-permissions 2>&1 | tee "$LOG_FILE"; then
    echo "✅ Iteration $ITERATION completed"

    # Check for completion signal
    if grep -q "<promise>COMPLETE</promise>" "$LOG_FILE"; then
      echo ""
      echo "🎉 ALL TASKS COMPLETE! 🎉"
      echo "Check claude-progress.txt for full summary"
      exit 0
    fi
  else
    echo "❌ Iteration $ITERATION failed"
    echo "Check $LOG_FILE for details"
  fi

  echo ""
  echo "⏳ Waiting 3 seconds before next iteration..."
  sleep 3

  ITERATION=$((ITERATION + 1))
done
