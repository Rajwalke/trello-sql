const z = require('zod');

const signupSchema = z.object({
    username: z.string().min(2),
    email: z.email(),
    password: z.string().min(6, "Please enter atleast 6 digit password")
        .regex(/[A-Z]/, 'At least one uppercase')
        .regex(/[a-z]/, 'At least one lowercase')
        .regex(/[0-9]/, 'At least one number')
        .regex(/[^A-Za-z0-9]/, 'At least one symbol')
})

const signinSchema = z.object({
    email: z.email(),
    password: z.string().min(6, "Incorrect Password!")
})

const organisationSchema = z.object({
    orgName: z.string().min(2),
})
module.exports = {
    signupSchema, signinSchema, organisationSchema
}