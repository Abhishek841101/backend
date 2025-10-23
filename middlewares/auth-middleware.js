import jwt from 'jsonwebtoken'
import UserModel from '../models/User.js'

var checkUserAuth = async (req, res, next) => {
  let token
  const { authorization } = req.headers
  if (authorization && authorization.startsWith('Bearer')) {
    try {
      token = authorization.split(' ')[1]

      const { userID } = jwt.verify(token, process.env.JWT_SECRET_KEY)

      req.user = await UserModel.findById(userID).select('-password')

      next()
    } catch (error) {
      console.log(error)
      res.status(401).send({ "status": "failed", "message": "Unauthorized User" })
    }
  }
  if (!token) {
    res.status(401).send({ "status": "failed", "message": "Unauthorized User, No Token" })
  }
}

const verifySocketToken = async (token) => {
  try {
    const { userID } = jwt.verify(token, process.env.JWT_SECRET_KEY)
    const user = await UserModel.findById(userID).select('-password')
    if (!user) throw new Error("User not found")
    return user
  } catch (error) {
    throw new Error("Invalid or expired token")
  }
}

export default checkUserAuth
export { verifySocketToken }

