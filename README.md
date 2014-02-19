PicCoder - A Node.JS image processing server in the style of Zencoder

Example request:
{
  "input": { "bucket": SRC_S3_BUCKET, "key": SRC_S3_KEY },
  "outputs": [{
    "bucket": DEST_S3_BUCKET,
    "key": DEST_S3_KEY,
    "mode": MODE,
    "width": WIDTH,
    "height": HEIGHT,
    "notification": OUTPUT_URL
  }, {
    "bucket": DEST_S3_BUCKET,
    "key": DEST_S3_KEY,
    "mode": MODE,
    "width": WIDTH,
    "height": HEIGHT,
    "notification": OUTPUT_URL
  }]
}

Definitions
==
SRC_S3_BUCKET     Name of S3 Bucket that contains the source file
SRC_S3_KEY        Filename and path of source file e.g. /foldername/filename.mp3
DEST_S3_BUCKET    Name of the S3 Bucket which the content is being sent to
DEST_S3_KEY       Filename and path of file to create on S3 e.g. /foldername/filename_small.jpg
OUTPUT_URL        URL of notification endpoint, hit with HTTP POST when Output completed
MODE              Resizing mode: scale = proportional resize,
                                 crop = exact size image cropped vertically or horizontally
                                 thumb = exact size image, no cropping, padded with solid colour
WIDTH             Width in pixels of output image
HEIGHT            Height in pixels of output image

Credentials (stored in creditals.json)
==
{ "accessKeyId": "xxx", "secretAccessKey": "xxx", "region": "eu-west-1" }
