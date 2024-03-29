import type User from '@resources/user/user.interface'
import UserService from '@resources/user/user.service'
import { hashPassword, isValidPassword } from '@utils/bcrypt.util'
import HttpException from '@utils/exceptions/http.exception'
import jwt from 'jsonwebtoken'

class AuthService {
    private readonly UserService = new UserService()

    public register = async (payload: User): Promise<User> => {
        const retrievedUser = await this.UserService.getByEmail(payload.email)
        if (retrievedUser != null) {
            throw new HttpException(400, 'User already exists')
        }

        const hashedPassword = await hashPassword(payload.password)

        try {
            const user = await new UserService().create({ ...payload, password: hashedPassword })
            return user
        } catch (error) {
            throw new Error('Cannot register user')
        }
    }

    public refreshToken = async (cookies: Record<string, any>): Promise<string> => {
        if (!cookies.jwt) {
            throw new HttpException(401, 'Unauthorized')
        }

        const refreshToken = cookies.jwt

        console.log(refreshToken)

        const foundUser = await this.UserService.getByRefreshToken(refreshToken)

        if (foundUser == null) {
            throw new HttpException(403, 'Forbidden')
        }

        let newAccessToken: string = ''

        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET!, (err: any, decoded: any) => {
            if (err || foundUser.email !== decoded.email) {
                throw new HttpException(403, 'Invalid token')
            }

            const accessToken = jwt.sign(
                { email: foundUser.email },
                process.env.ACCESS_TOKEN_SECRET!,
                { expiresIn: '30s' },
            )

            newAccessToken = accessToken
        })

        return newAccessToken
    }

    public login = async ({
        email,
        password,
    }: {
        email: string
        password: string
    }): Promise<{ accessToken: string; refreshToken: string }> => {
        try {
            const retrievedUser = await this.UserService.getByEmail(email)

            if (retrievedUser == null) {
                throw new HttpException(401, "User doesn't exist")
            }

            if (!(await isValidPassword(password, retrievedUser.password))) {
                throw new HttpException(403, 'Invalid password')
            }

            const accessToken = jwt.sign(
                { email: retrievedUser.email },
                process.env.ACCESS_TOKEN_SECRET!,
                { expiresIn: '30s' },
            )

            const refreshToken = jwt.sign(
                { email: retrievedUser.email },
                process.env.REFRESH_TOKEN_SECRET!,
                { expiresIn: '1d' },
            )

            await this.UserService.updateByEmail(email, { refreshToken })

            return { accessToken, refreshToken }
        } catch (err) {
            throw new HttpException(400, `User login request failed`)
        }
    }
}

export default AuthService
