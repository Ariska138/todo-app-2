import 'dotenv/configs';
import { db } from './index.js';
import bcrypt from 'bcryptjs';
import { todos, users } from "./schema.js";

async function seed() {
    console.log("Sending Database...");

    //hapus data lama (optimal)
    await db.delete(todos);
    await db.delete(users);

    //buat users dummy dengan password yang sudah di hash
    const plainPassword = 'password123'
    const hashedPassword = await bcrypt.hash(plainPassword, 10) // hash password

    //buat users dummy
    const userl = await db
    .insert(users)
    .values({
        username: "andi",
        password: hashedPassword,//selalu simpan password yang sudah di hash
    })
    .returning();

    //buat todo dummy untuk users
    await db.insert(todos).values([
        { note: 'Belajar Drizzle ORM', userId: userl[0].id },
        { note: 'Membuat API dengan Hono', userId: userl[0].id },
    ]);

    console.log("Seeding Completed");
    process.exit(0);
}

send().catch((err) => {
    console.error("Seeding Failed: ", err);
    process.exit(1);
});