const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/zozoo/.gemini/antigravity/brain/ababa079-367a-4a6b-a1b5-9bb6d141af0b/.system_generated/logs/transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let allInputs = '';
  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'USER_INPUT') {
        allInputs += parsed.content + '\n==================\n';
      }
    } catch(e) {}
  }
  fs.writeFileSync('f:/code/eva/evaprojectmultiplatforme/all_inputs.txt', allInputs);
  console.log('done');
}
processLineByLine();
