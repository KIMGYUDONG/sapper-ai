const MESSAGE = "SapperAI installed. Run 'npx sapper-ai scan' and follow the prompts to harden your setup."

export function runPostinstall(): void {
  try {
    console.log(MESSAGE)
  } catch {
  }
}

if (require.main === module) {
  runPostinstall()
}
