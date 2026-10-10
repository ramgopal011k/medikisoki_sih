-- Update foreign key constraint on sessions so deleting a hospital sets hospital_id to NULL
ALTER TABLE IF EXISTS sessions 
  DROP CONSTRAINT IF EXISTS sessions_hospital_id_fkey;

ALTER TABLE IF EXISTS sessions 
  ADD CONSTRAINT sessions_hospital_id_fkey 
  FOREIGN KEY (hospital_id) 
  REFERENCES hospitals(id) 
  ON DELETE SET NULL;
