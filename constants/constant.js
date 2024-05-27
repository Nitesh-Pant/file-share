require('dotenv').config()

const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME

const MONGO_PASS = process.env.MONGO_PASS
const MONGO_USERNAME = process.env.MONGO_USERNAME

const SHORT_URL_LINK = "http://43.205.62.246:8000/api/get-file/"
module.exports = {
    AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY,
    AWS_BUCKET_NAME,
    MONGO_PASS,
    MONGO_USERNAME,
    SHORT_URL_LINK
}