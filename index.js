const express = require('express')
const multer = require('multer')
const QRCode = require('qrcode')
const { MongoClient } = require('mongodb');
const cors = require('cors');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
const { AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME, MONGO_PASS, MONGO_USERNAME, SHORT_URL_LINK } = require('./constants/constant.js')
const app = express()
const PORT = 8000
require('dotenv').config()

app.use(express.json());
app.use(cors());

// multer configuration
const storage = multer.memoryStorage()
const upload = multer({ storage: storage, limits: { fileSize: 1024 * 1024 * 100 } /* limit file size to 100 mb*/ })

// aws s3 client setup
const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
})

// mongo connection
let db;
(async () => {
    let MONGO_URL = `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASS}@cluster0.ievbosn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0` //"mongodb://localhost:27017"
    let DB_NAME = "file-share"
    const client = new MongoClient(MONGO_URL);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        db = client.db(DB_NAME);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
})();

// Handle file size limit exceeded error
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            res.status(400).send('File size limit exceeded (100 MB)');
            return;
        }
    }
    next(err);
});

// ping api
app.get('/ping', (req, res) => {
    console.log('Health 100%')
    res.status(200).json({ message: 'Health 100%' })
})

// base api
app.get('/', (req, res) => {
    res.status(200).send('Running')
})


// api to upload file to s3, mongo entry, signed url
app.post('/api/upload', upload.single('file'), async (req, res) => {

    // check if file exists or not
    if (!req.file) {
        return res.status(400).send('No files were uploaded.');
    }

    const fileData = req.file
    // create file name ex. files/images-12091239.png
    const filename = `files/${fileData.mimetype.split('/')[0]}-${Date.now()}.${fileData.mimetype.split('/')[1]}`

    // command to put object in bucket
    const command = new PutObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: `${filename}`,
        Body: fileData.buffer,
        ContentType: `${fileData.mimetype}`
    })

    try {
        await s3Client.send(command)
        console.log('file uploaded')

        // command to get object inside bucket
        const newCommand = new GetObjectCommand({
            Bucket: AWS_BUCKET_NAME,
            Key: filename
        })

        // generate signed url
        const sigendURL = await getSignedUrl(s3Client, newCommand)
        console.log(`signed url generated successfully`)

        // generate short url
        const alphaString = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        const numString = "01234567890"
        let shortURL = SHORT_URL_LINK
        for (let i = 0; i < 5; i++) {
            i == 3 ? shortURL += numString[Math.floor(Math.random() * 11)] : shortURL += alphaString[Math.floor(Math.random() * 27)]
        }

        // upload original url and short url to mongo collections
        const uploadedFile = await db.collection('files').insertOne({ originalURL: sigendURL, shortURL: shortURL, createdAt: Date.now() })
        console.log(uploadedFile)
        console.log(`inserted to mongo`);


        // generate qr code html and send as response
        QRCode.toDataURL(shortURL, /*{ type: 'terminal' },*/(err, url) => {
            if (err) {
                console.log(err)
                throw err
            }
            console.log(`QR code generated successfully`)
            res.status(200).send(`
            <!DOCTYPE html>
            <html>
                <head></head>
                <body>
                    <img src="${url}" alt="QR Code">
                    <p>OR</p>
                    <a href="${shortURL}">Click me<a>
                </body>
            </html>
            `)
        })
    }
    catch (err) {
        console.log(err)
        res.status(500).send("Internal Server Error")
    }
})

// short url to original url redirect api
app.get('/api/get-file/:file', async (req, res) => {
    // get file name from url
    const fileName = req.params.file
    //console.log(fileName)

    // search file name in mongo db and return original file
    try {
        let response = await db.collection('files').findOne({
            shortURL: `${SHORT_URL_LINK}${fileName}`
        })
        //console.log(response)
        if (response) {
            console.log('redirecting')
            res.redirect(`${response.originalURL}`);
        }
        else {
            console.log('invalid url')
            res.status(400).send('Invalid file Request')
        }
    }
    catch (err) {
        console.log(err)
        res.status(500).send(err)
    }

})


app.listen(process.env.PORT || PORT, () => {
    console.log(`Application running on port ${PORT}`)
})
