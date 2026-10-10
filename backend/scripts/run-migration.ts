import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';


// Read backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error('Error: SUPABASE_ACCESS_TOKEN is missing in backend/.env');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  let projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!projectRef && supabaseUrl) {
    try {
      const parsedUrl = new URL(supabaseUrl);
      projectRef = parsedUrl.hostname.split('.')[0];
    } catch {
      const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\./);
      if (match) {
        projectRef = match[1];
      }
    }
  }

  if (!projectRef) {
    console.error('Error: Could not extract Supabase project ref from SUPABASE_URL');
    process.exit(1);
  }

  const filename = process.argv[2];
  if (!filename) {
    console.error('Error: Missing migration file argument.');
    console.error('Usage: tsx scripts/run-migration.ts <filename.sql>');
    process.exit(1);
  }

  const baseFilename = path.basename(filename);
  const migrationPath = path.resolve(__dirname, '../migrations', baseFilename);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log(`Running migration "${baseFilename}" on project [${projectRef}]...`);

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sql })
    });

    const status = response.status;
    const responseText = await response.text();

    console.log(`Status: ${status} ${response.statusText}`);
    console.log(`Body: ${responseText}`);

    if (response.ok) {
      console.log('Migration completed successfully.');
      process.exit(0);
    } else {
      console.error('Migration failed.');
      process.exit(1);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Request error: ${message}`);
    process.exit(1);
  }
}

main();
