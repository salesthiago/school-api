import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserSchema } from '../../users/schemas/user.schema';
import { Role } from '../../common/enums/role.enum';

/**
 * Cria (ou garante) o usuário administrador inicial da escola.
 *
 * Não há framework de migration para Mongoose neste projeto, então este
 * script é o caminho para provisionar o primeiro admin sem depender da
 * rota POST /users (que já exige um admin autenticado — problema do
 * "ovo e da galinha"). Idempotente: se o e-mail já existir, apenas garante
 * role=admin e active=true, sem sobrescrever a senha já em uso.
 *
 * Uso: npm run migrate:create-admin
 */
const ADMIN_EMAIL = 'escola@godprovider.com.br';
const ADMIN_PASSWORD = 'VidaVida@2026';
const ADMIN_NAME = 'Administrador GPschool';

async function run() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/gpschool';
  await mongoose.connect(uri);

  const UserModel = mongoose.model(User.name, UserSchema);
  const email = ADMIN_EMAIL.toLowerCase().trim();

  const existing = await UserModel.findOne({ email });
  if (existing) {
    existing.role = Role.ADMIN;
    existing.active = true;
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`Usuário admin já existia (${email}); role/active garantidos, senha mantida.`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await UserModel.create({
      name: ADMIN_NAME,
      email,
      passwordHash,
      role: Role.ADMIN,
      active: true,
    });
    // eslint-disable-next-line no-console
    console.log(`Usuário admin criado com sucesso: ${email}`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Falha ao criar usuário admin:', err);
  process.exit(1);
});
