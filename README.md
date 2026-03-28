docker build -t web3-debian-vnc:challenge1 . 

docker run -d -p 8080:8080 --name web3-debian-vnc-challenge1 web3-debian-vnc:challenge1


wait for 30 sec to let everything start 