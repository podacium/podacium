import { User } from '../models/User'

export interface UserRepository {
    getUserById(id: string): Promise<User | null>
}
