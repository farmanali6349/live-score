import express from 'express'

const app = express()
const port = process.env.PORT || 3000;


app.use(express.json());

// Get Route
app.get("/", (req, res) => {
    res.send("Hello World!")
})

// Server Listening
app.listen(port, () => {
    console.log(`Server started on port http://localhost:${port}`)
})