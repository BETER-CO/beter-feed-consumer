# BETER-FEED-CONSUMER

This tools was designed to track latency and provide validation of data. It ships with tcpdump with TLS
keylog enabled to intercept and decrypt TLS traffic to the BETER's Feed.

[Video Tutorial is available too! Check it on YouTube!](https://www.youtube.com/watch?v=PWCLpECii9A)

## Run it

### Manual run

Make sure that the current working directory is the same as the root directory of the repository.
If you didn't clone the repository make sure that in your current working directory folder `var` was created:

```shell
$ pwd
/home/woz/project/beter-feed-consumer

$ ls -la
drwxr-xr-x   7 woz  staff    578 Sep 26 14:40 .
drwxr-xr-x  14 woz  staff    510 Aug 30 14:05 ..
drwxr-xr-x   2 woz  staff    850 Sep 26 14:41 var
```

Run container with `tcpdump`

```shell
$ docker run --rm -it --net=host \
  --name beter-feed-tcpdump \
  -v "$PWD/var:/tcpdump_log" \
  corfr/tcpdump:latest \
  -i any -w "/tcpdump_log/dump_%m-%d-%H-%M-%S-%s.pcap" -G 3600 -v
```

`tcpdump` will capture packets and store them on the host machine in the file `./var/dump_XXX.pcap`. If the
size of the file will exceed 1Gb file rotation will happen and another file with new postfix will be created.
Also, every 1 hour the new file with consecutive postfix will be created.

> Note! MacOS doesn't support --net=host, so you will not be able to run this command and gather all required
> information, so run it in Linux.
> 
> Also, take into account that the image `corfr/tcpdump` supports only `x86_64` architecture. Build your own image
> if you need arm.

In the new terminal window run container with the Feed consumer.
Don't forget to put BETER's Feed domain provided to you, ApiKey and channel you want to track.

```shell
$ docker run --rm -it --net=host \
  --name beter-feed-consumer \
  -v "$PWD/var:/app/var" \
  dmenshikov/beter-feed-consumer:latest \
  start-with-tls-keylog -- --logLevel info \
  --feed-domain beter.feed.domain.com \
  --api-key XXXX-XXXX \
  --channel-name time_table > "var/consumer_timetable_$(date +'%Y-%m-%d_%H-%M-%S').log" 2>&1
```

During the analysis you may read the log file by the following command (use the right filename!):

```shell
$ ls -la var/

-rw-r--r--  1 woz  staff   1104 Sep 26 11:53 consumer_timetable_2023-09-26_11-53-18.log
-rw-r--r--  1 woz  staff  24291 Sep 26 11:58 consumer_timetable_2023-09-26_11-55-30.log
-rw-r--r--  1 woz  staff    836 Sep 26 11:43 dump_2023-09-26_11-42-05.pcap
-rw-r--r--  1 woz  staff   1060 Sep 26 11:53 dump_2023-09-26_11-52-14.pcap
-rw-------  1 woz  staff   3528 Sep 26 11:57 tls_keylog.txt

$ tail -f var/consumer_timetable_2023-09-26_11-55-30.log

```
To stop any container press `Ctrl-C`, but first stop the consumer and then `tcpdump`.

### Automatic run with docker compose

TBD

## Pack the data for analysis

Pack all the content in the folder `var`:
- dump_YYYY-MM-DD_hh-mm-ss.pcap
- consumer_%channel%_YYYY-MM-DD_hh-mm-ss.log
- tls_keylog.txt

You may use the command `tar cvzf beter-feed-captured-data.tar.gz var/`

Some files may be created by `root`, so you need to use `sudo` or `chown` to change permissions.

```shell
$ sudo tar cvzf beter-feed-captured-data.tar.gz var/
```
