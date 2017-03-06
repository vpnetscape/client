package profile

const (
	blockScript = "#!/bin/bash\n"
	upScript    = `#!/bin/bash -e

CONN_ID="$(echo ${config} | /sbin/md5)"

for optionname in ${!foreign_option_*} ; do
  option="${!optionname}"
  echo $option
  part1=$(echo "$option" | cut -d " " -f 1)
  if [ "$part1" == "dhcp-option" ] ; then
    part2=$(echo "$option" | cut -d " " -f 2)
    part3=$(echo "$option" | cut -d " " -f 3)
    if [ "$part2" == "DNS" ] ; then
      DNS_SERVERS="$DNS_SERVERS $part3"
    fi
    if [[ "$part2" == "DOMAIN" || "$part2" == "DOMAIN-SEARCH" ]] ; then
      DNS_SEARCH="$DNS_SEARCH $part3"
    fi
  fi
done

if [ -z "$DNS_SERVERS" ] && [ -z "$DNS_SEARCH" ]; then
  exit 0
fi

SERVICE_ID="$(/usr/sbin/scutil <<-EOF |
open
show State:/Network/Global/IPv4
quit
EOF
grep PrimaryService | sed -e 's/.*PrimaryService : //'
)"

SERVICE_ORIG="$(/usr/sbin/scutil <<-EOF |
open
show State:/Network/Service/${SERVICE_ID}/DNS
quit
EOF
grep vpnetscape | sed -e 's/.*vpnetscape : //'
)"

if [ "$SERVICE_ORIG" != "true" ]; then
  /usr/sbin/scutil <<-EOF > /dev/null
open
get State:/Network/Service/${SERVICE_ID}/DNS
set State:/Network/vpnetscape/Restore/${SERVICE_ID}
quit
EOF
fi

if [ "$DNS_SERVERS" ] && [ "$DNS_SEARCH" ]; then
  /usr/sbin/scutil <<-EOF > /dev/null
open
d.init
d.add ServerAddresses * ${DNS_SERVERS}
d.add SearchDomains * ${DNS_SEARCH}
d.add vpnetscape true
set State:/Network/Service/${SERVICE_ID}/DNS
set Setup:/Network/Service/${SERVICE_ID}/DNS
set State:/Network/vpnetscape/DNS
set State:/Network/vpnetscape/Connection/${CONN_ID}
quit
EOF
elif [ "$DNS_SERVERS" ]; then
  /usr/sbin/scutil <<-EOF > /dev/null
open
d.init
d.add ServerAddresses * ${DNS_SERVERS}
d.add vpnetscape true
set State:/Network/Service/${SERVICE_ID}/DNS
set Setup:/Network/Service/${SERVICE_ID}/DNS
set State:/Network/vpnetscape/DNS
set State:/Network/vpnetscape/Connection/${CONN_ID}
quit
EOF
elif [ "$DNS_SEARCH" ]; then
  /usr/sbin/scutil <<-EOF > /dev/null
open
d.init
d.add SearchDomains * ${DNS_SEARCH}
d.add vpnetscape true
set State:/Network/Service/${SERVICE_ID}/DNS
set Setup:/Network/Service/${SERVICE_ID}/DNS
set State:/Network/vpnetscape/DNS
set State:/Network/vpnetscape/Connection/${CONN_ID}
quit
EOF
fi

killall -HUP mDNSResponder | true

exit 0`
	downScript = `#!/bin/bash -e

CONN_ID="$(echo ${config} | /sbin/md5)"

/usr/sbin/scutil <<-EOF > /dev/null
open
remove State:/Network/vpnetscape/Connection/${CONN_ID}
remove State:/Network/vpnetscape/DNS
quit
EOF

exit 0`
)
