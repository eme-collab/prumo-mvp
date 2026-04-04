import 'server-only'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

function getFfmpegPath() {
  // Carrega em runtime, depois de externalizar o pacote no Next
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegPath = require('ffmpeg-static')
  return ffmpegPath as string | null
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpegPath = getFfmpegPath()

    if (!ffmpegPath) {
      reject(new Error('FFmpeg não encontrado.'))
      return
    }

    const process = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })

    let stderr = ''

    process.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    process.on('error', (error) => {
      reject(error)
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(stderr || `FFmpeg falhou com código ${code}`))
    })
  })
}

export async function convertAudioBufferToWav(
  inputBuffer: Buffer,
  inputExtension: string
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prumo-audio-'))

  const inputPath = path.join(tempDir, `input.${inputExtension}`)
  const outputPath = path.join(tempDir, 'output.wav')

  try {
    await fs.writeFile(inputPath, inputBuffer)

    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-ac',
      '1',
      '-ar',
      '16000',
      '-c:a',
      'pcm_s16le',
      outputPath,
    ])

    const outputBuffer = await fs.readFile(outputPath)
    return outputBuffer
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}