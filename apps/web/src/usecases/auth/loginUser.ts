import { UserRepository } from '../../domain/repositories/UserRepository'

export async function loginUser(repo: UserRepository, email: string, password: string) {
    const user = await repo.getUserById(email)
    return user
}
