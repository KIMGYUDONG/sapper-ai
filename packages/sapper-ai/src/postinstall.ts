const MESSAGE = "SapperAI installed. Run 'npx sapper-ai scan' to check your environment."

export function runPostinstall(): void {
  try {
    console.log(MESSAGE)
  } catch {
  }
}

if (require.main === module) {
  runPostinstall()
}
